/**
 * position_provider.js — Hợp nhất các nguồn vị trí của app chính.
 * Chỉ giữ bản ghi mới nhất cho mỗi nguồn, trong bộ nhớ. Không DOM, không mạng,
 * không storage, không log. Bản thử nghiệm.
 */

export const SOURCE_PRIORITY = ['native', 'ble', 'bridge', 'mock', 'url', 'manual']; // beacon trước, thủ công sau
export const CONFIDENCE_MIN = 0.5;  // Cần xác nhận
export const STALE_MS = 15000;      // Cần xác nhận (khớp SIGNAL_TIMEOUT_MS của bridge_source)

const BEACON_SOURCES = ['native', 'ble', 'bridge', 'mock'];
const USER_SOURCES = ['url', 'manual'];

export function createPositionProvider({ now = () => Date.now() } = {}) {
  const records = new Map(); // source → { source, roomId, floorId, confidence, timestamp, lost }
  const subs = new Set();
  let lastSig = null;

  function floorOf(roomId, floorId) {
    return floorId ?? (typeof roomId === 'string' ? roomId.split('_')[0] : null);
  }

  function isFresh(rec) { return now() - rec.timestamp <= STALE_MS; }

  function compute() {
    // 1. Beacon còn hiệu lực và đủ tin cậy (theo thứ tự ưu tiên)
    for (const src of BEACON_SOURCES) {
      const r = records.get(src);
      if (r && !r.lost && isFresh(r) && r.confidence >= CONFIDENCE_MIN) {
        return { ...r, lowConfidence: false, isUserChosen: false };
      }
    }
    // 2. Người dùng tự chọn (bản ghi mới nhất giữa url/manual)
    let user = null;
    for (const src of USER_SOURCES) {
      const r = records.get(src);
      if (r && (!user || r.timestamp >= user.timestamp)) user = r;
    }
    if (user) return { ...user, lowConfidence: false, isUserChosen: true };
    // 3. Chỉ còn beacon yếu/mất/quá hạn: giữ điểm cuối ở trạng thái độ tin cậy thấp
    let last = null;
    for (const src of BEACON_SOURCES) {
      const r = records.get(src);
      if (r && (!last || r.timestamp > last.timestamp)) last = r;
    }
    if (last) return { ...last, lowConfidence: true, isUserChosen: false };
    return null;
  }

  function signature(cur) {
    return cur ? `${cur.source}|${cur.roomId}|${cur.floorId}|${cur.lowConfidence}` : 'none';
  }

  function emit() {
    const cur = compute();
    lastSig = signature(cur);
    for (const fn of [...subs]) fn(cur);
  }

  const api = {
    report({ source, roomId, floorId, confidence, timestamp } = {}) {
      if (!BEACON_SOURCES.includes(source) || !roomId) return;
      const c = Number.isFinite(confidence) ? confidence : 0;
      records.set(source, {
        source, roomId, floorId: floorOf(roomId, floorId),
        confidence: c, timestamp: Number.isFinite(timestamp) ? timestamp : now(), lost: false,
      });
      emit();
    },

    setManual({ roomId, floorId, source = 'manual' } = {}) {
      if (!roomId) return;
      const src = source === 'url' ? 'url' : 'manual';
      records.set(src, {
        source: src, roomId, floorId: floorOf(roomId, floorId),
        confidence: 1, timestamp: now(), lost: false,
      });
      emit();
    },

    markLost(source) {
      const r = records.get(source);
      if (!r) return;
      r.lost = true;
      emit();
    },

    current() { return compute(); },

    isReliable() {
      const cur = compute();
      return !!cur && !cur.lowConfidence;
    },

    status() {
      const cur = compute();
      if (!cur) return 'none';
      if (cur.isUserChosen) return 'manual';
      return cur.lowConfidence ? 'beacon-low' : 'beacon';
    },

    /** Đánh giá lại (vd. quá hạn theo thời gian); chỉ thông báo nếu trạng thái đổi. */
    refresh() {
      const cur = compute();
      if (signature(cur) !== lastSig) emit();
    },

    subscribe(fn) {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },

    clear() {
      records.clear();
      emit();
    },
  };
  return api;
}
