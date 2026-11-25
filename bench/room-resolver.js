/**
 * room-resolver.js — Phân giải beacon → phòng hiện tại
 * Dựa trên giả thuyết proximity/zone (ARCHITECTURE.md mục 9).
 *
 * Tham số chưa hiệu chỉnh — tất cả ghi "Cần xác nhận bằng đo thực".
 * Không cam kết sai số nếu chưa có dữ liệu bench thực tế.
 *
 * Module thuần JS — không phụ thuộc, không CDN; chạy được cả trên trình duyệt và Node.js.
 */

// ─── Tham số mặc định (Cần xác nhận bằng đo thực) ─────────────────────────────
export const DEFAULT_PARAMS = {
  windowSize:       5,     // số mẫu trung bình trượt (Cần xác nhận)
  iqrOutlierFactor: 1.5,   // hệ số IQR loại ngoại lai (Cần xác nhận)
  sampleTTL_ms:   10_000,  // thời gian hết hạn mẫu cũ (ms) (Cần xác nhận)
  rssiThreshold:    -80,   // ngưỡng RSSI tối thiểu để tính (dBm) (Cần xác nhận)
  hysteresisMargin:   5,   // beacon mạnh nhất phải hơn thứ hai ít nhất N dBm (Cần xác nhận)
  minConsecutive:     3,   // số lần đọc liên tiếp đồng thuận trước khi kết luận (Cần xác nhận)
};

// ─── Kiểu dữ liệu ──────────────────────────────────────────────────────────────
/**
 * @typedef {Object} BeaconSample
 * @property {string} beaconKey  — "<uuid-lower>-<major>-<minor>" hoặc khóa tùy chọn
 * @property {number} rssi       — dBm (âm, càng gần 0 càng mạnh)
 * @property {number} timestamp  — Date.now()
 */

/**
 * @typedef {Object} RoomMapEntry
 * @property {string} beaconKey
 * @property {string} roomId
 * @property {string} [roomName]
 */

/**
 * @typedef {Object} ResolverResult
 * @property {'near-room'|'uncertain'|'lost'} status
 * @property {string|null}  roomId
 * @property {string|null}  roomName
 * @property {string}       reason    — mô tả ngắn
 * @property {number|null}  smoothedRssi  — RSSI đã làm mượt của beacon tốt nhất
 * @property {string|null}  beaconKey
 */

// ─── Tiện ích thống kê ─────────────────────────────────────────────────────────

/** Tính trung vị của mảng số (không sắp xếp tại chỗ). */
function median(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

/** Tính tứ phân vị Q1 và Q3 của mảng số đã sắp xếp. */
function quartiles(sorted) {
  const n = sorted.length;
  if (n < 4) return { q1: sorted[0] ?? 0, q3: sorted[n - 1] ?? 0 };
  const mid = Math.floor(n / 2);
  const lower = sorted.slice(0, mid);
  const upper = n % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1);
  return { q1: median(lower), q3: median(upper) };
}

/** Loại ngoại lai IQR: giữ lại phần tử trong [Q1 - factor*IQR, Q3 + factor*IQR]. */
function removeIQROutliers(values, factor = 1.5) {
  if (values.length < 4) return values; // quá ít để lọc
  const sorted = [...values].sort((a, b) => a - b);
  const { q1, q3 } = quartiles(sorted);
  const iqr = q3 - q1;
  const lo = q1 - factor * iqr;
  const hi = q3 + factor * iqr;
  return values.filter(v => v >= lo && v <= hi);
}

// ─── RoomResolver ──────────────────────────────────────────────────────────────

export class RoomResolver {
  /**
   * @param {RoomMapEntry[]} beaconMap  — ánh xạ beaconKey → roomId
   * @param {Partial<typeof DEFAULT_PARAMS>} [params]
   */
  constructor(beaconMap = [], params = {}) {
    this._map = new Map(beaconMap.map(e => [e.beaconKey, e]));
    this._params = { ...DEFAULT_PARAMS, ...params };

    // beaconKey → mảng { rssi, timestamp } còn trong TTL
    this._samples = new Map();

    // Theo dõi kết luận liên tiếp để kiểm tra minConsecutive
    this._consecutiveRoomId  = null;
    this._consecutiveCount   = 0;

    // Kết quả cuối cùng đã kết luận (dùng cho fallback mất tín hiệu)
    this._lastConfidentRoom  = null;
  }

  /** Cập nhật bảng ánh xạ beacon→phòng lúc chạy (không cần khởi tạo lại). */
  setBeaconMap(beaconMap) {
    this._map = new Map(beaconMap.map(e => [e.beaconKey, e]));
  }

  /** Thêm một mẫu đo mới vào bộ đệm. */
  addSample(beaconKey, rssi, timestamp = Date.now()) {
    if (!this._samples.has(beaconKey)) this._samples.set(beaconKey, []);
    this._samples.get(beaconKey).push({ rssi, timestamp });
  }

  /** Xóa toàn bộ mẫu đo (reset trạng thái). */
  reset() {
    this._samples.clear();
    this._consecutiveRoomId = null;
    this._consecutiveCount  = 0;
    this._lastConfidentRoom = null;
  }

  /**
   * Tính RSSI đã làm mượt cho một beaconKey.
   * Loại mẫu hết hạn → lọc IQR → trung bình trượt N mẫu cuối.
   * @returns {number|null} — null nếu không có mẫu hợp lệ
   */
  _smoothed(beaconKey, now = Date.now()) {
    let buf = this._samples.get(beaconKey) ?? [];

    // Loại mẫu hết hạn
    buf = buf.filter(s => now - s.timestamp <= this._params.sampleTTL_ms);
    this._samples.set(beaconKey, buf);

    if (buf.length === 0) return null;

    // Lấy N mẫu cuối rồi lọc IQR
    const win = buf.slice(-this._params.windowSize).map(s => s.rssi);
    const filtered = removeIQROutliers(win, this._params.iqrOutlierFactor);
    if (filtered.length === 0) return null;

    return filtered.reduce((a, v) => a + v, 0) / filtered.length;
  }

  /**
   * Kết luận phòng hiện tại dựa trên tất cả mẫu đo hiện có.
   * Gọi sau mỗi lần addSample() để lấy kết quả mới nhất.
   *
   * @param {number} [now] — timestamp để so sánh TTL (mặc định Date.now())
   * @returns {ResolverResult}
   */
  resolve(now = Date.now()) {
    const { rssiThreshold, hysteresisMargin, minConsecutive } = this._params;

    // Tính RSSI đã làm mượt cho từng beacon đã biết (có trong map)
    const candidates = [];
    for (const [beaconKey, entry] of this._map) {
      const rssi = this._smoothed(beaconKey, now);
      if (rssi !== null) candidates.push({ beaconKey, rssi, entry });
    }

    // Không có dữ liệu nào
    if (candidates.length === 0) {
      this._consecutiveRoomId = null;
      this._consecutiveCount  = 0;
      if (this._lastConfidentRoom) {
        return {
          status: 'lost',
          roomId: this._lastConfidentRoom.roomId,
          roomName: this._lastConfidentRoom.roomName ?? null,
          reason: 'mất tín hiệu, dùng mốc cuối cùng',
          smoothedRssi: null,
          beaconKey: null,
        };
      }
      return {
        status: 'uncertain',
        roomId: null, roomName: null,
        reason: 'chưa có mẫu',
        smoothedRssi: null, beaconKey: null,
      };
    }

    // Sắp xếp giảm dần theo RSSI
    candidates.sort((a, b) => b.rssi - a.rssi);
    const best   = candidates[0];
    const second = candidates[1] ?? null;

    // Kiểm tra ngưỡng RSSI
    if (best.rssi < rssiThreshold) {
      this._consecutiveRoomId = null;
      this._consecutiveCount  = 0;
      return {
        status: 'uncertain',
        roomId: null, roomName: null,
        reason: `quá yếu (${best.rssi.toFixed(1)} dBm < ngưỡng ${rssiThreshold} dBm)`,
        smoothedRssi: best.rssi,
        beaconKey: best.beaconKey,
      };
    }

    // Kiểm tra hysteresis: phải hơn beacon thứ hai ít nhất hysteresisMargin dBm
    if (second && (best.rssi - second.rssi) < hysteresisMargin) {
      this._consecutiveRoomId = null;
      this._consecutiveCount  = 0;
      return {
        status: 'uncertain',
        roomId: null, roomName: null,
        reason: `chồng lấn (${best.beaconKey} mạnh hơn ${second.beaconKey} chỉ ${(best.rssi - second.rssi).toFixed(1)} dBm < biên ${hysteresisMargin} dBm)`,
        smoothedRssi: best.rssi,
        beaconKey: best.beaconKey,
      };
    }

    // Kiểm tra minConsecutive: bộ đếm liên tiếp
    if (this._consecutiveRoomId === best.entry.roomId) {
      this._consecutiveCount++;
    } else {
      this._consecutiveRoomId = best.entry.roomId;
      this._consecutiveCount  = 1;
    }

    if (this._consecutiveCount < minConsecutive) {
      return {
        status: 'uncertain',
        roomId: null, roomName: null,
        reason: `chờ xác nhận (${this._consecutiveCount}/${minConsecutive} lần liên tiếp)`,
        smoothedRssi: best.rssi,
        beaconKey: best.beaconKey,
      };
    }

    // ✅ Đủ điều kiện kết luận
    const result = {
      status:      'near-room',
      roomId:      best.entry.roomId,
      roomName:    best.entry.roomName ?? null,
      reason:      `beacon ${best.beaconKey}, RSSI ${best.rssi.toFixed(1)} dBm`,
      smoothedRssi: best.rssi,
      beaconKey:   best.beaconKey,
    };
    this._lastConfidentRoom = { roomId: result.roomId, roomName: result.roomName };
    return result;
  }

  /** Trả về thống kê nhanh: trung bình, trung vị, độ lệch chuẩn, min, max của RSSI thô (chưa lọc) cho beaconKey. */
  stats(beaconKey, now = Date.now()) {
    const buf = (this._samples.get(beaconKey) ?? [])
      .filter(s => now - s.timestamp <= this._params.sampleTTL_ms)
      .map(s => s.rssi);
    if (buf.length === 0) return null;
    const mean = buf.reduce((a, v) => a + v, 0) / buf.length;
    const med  = median(buf);
    const std  = Math.sqrt(buf.reduce((a, v) => a + (v - mean) ** 2, 0) / buf.length);
    return {
      count: buf.length,
      mean: +mean.toFixed(2),
      median: +med.toFixed(2),
      std:  +std.toFixed(2),
      min:  Math.min(...buf),
      max:  Math.max(...buf),
    };
  }
}
