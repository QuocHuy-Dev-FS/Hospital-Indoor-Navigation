/**
 * beacon-source.js — Nguồn dữ liệu beacon (thật và giả lập)
 *
 * Interface chung: { start(onAdvertisement), stop(), type }
 * callback onAdvertisement(event):
 *   event.beaconKey    — chuỗi nhận dạng beacon (từ parser) hoặc 'sim-<id>'
 *   event.rssi         — dBm (số)
 *   event.timestamp    — Date.now()
 *   event.manufacturerData — Map<companyId, DataView> (thật) hoặc giả lập
 *   event.serviceData  — Map (thật) hoặc null
 *   event.synthetic    — true nếu là dữ liệu tổng hợp (giả lập)
 *
 * Module thuần JS — không phụ thuộc, không CDN; chạy được trên trình duyệt.
 * (Không dùng được trên Node.js vì cần Web Bluetooth API và DataView/Map của trình duyệt.)
 */

import { parseManufacturerData, iBeaconKey, buildIBeaconManufacturerData } from './packet-parser.js';

// ─── Kiểm tra tính năng trình duyệt ───────────────────────────────────────────

/**
 * Kiểm tra 3 phép kiểm tra khả năng Web Bluetooth của trình duyệt hiện tại.
 * Dùng feature detection, không dò tên trình duyệt (user-agent).
 *
 * @returns {{ hasBluetooth: boolean, hasLEScan: boolean, hasWatchAdvertisements: boolean }}
 */
export function detectBluetooth() {
  const hasBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const hasLEScan = hasBluetooth && typeof navigator.bluetooth.requestLEScan === 'function';
  const hasWatchAdvertisements = hasBluetooth &&
    typeof navigator.bluetooth.requestDevice === 'function' &&
    // watchAdvertisements tồn tại trên BluetoothDevice prototype sau khi requestDevice trả về
    // Chỉ kiểm tra sự tồn tại của requestDevice + getAvailability (proxy tốt nhất có thể lúc load)
    typeof navigator.bluetooth.getAvailability === 'function';
  return { hasBluetooth, hasLEScan, hasWatchAdvertisements };
}

// ─── Nguồn THẬT: Web Bluetooth ────────────────────────────────────────────────

export class RealSource {
  constructor() {
    this.type = 'real';
    this._scan = null;
    this._devices = new Map(); // deviceId → device
    this._running = false;
  }

  /**
   * Bắt đầu quét BLE thật.
   * Phát hiện tính năng theo thứ tự:
   *  1) requestLEScan → quét quảng bá trực tiếp
   *  2) requestDevice + watchAdvertisements → người dùng chọn thiết bị
   *  3) Không có → ném lỗi để UI xử lý
   *
   * @param {function} onAdvertisement — callback(event)
   * @throws {Error} nếu không có API hoặc người dùng từ chối quyền
   */
  async start(onAdvertisement) {
    const { hasBluetooth, hasLEScan } = detectBluetooth();

    if (!hasBluetooth) {
      throw new Error('NO_BT_API: Trình duyệt không hỗ trợ Web Bluetooth. Xem hướng dẫn bật cờ trong bench/README.md.');
    }

    this._running = true;

    if (hasLEScan) {
      await this._startLEScan(onAdvertisement);
    } else {
      await this._startWatchAdvertisements(onAdvertisement);
    }
  }

  async _startLEScan(onAdvertisement) {
    // requestLEScan: quét tất cả thiết bị quảng bá, không cần người dùng chọn
    // Yêu cầu cờ: chrome://flags/#enable-experimental-web-platform-features
    this._scan = await navigator.bluetooth.requestLEScan({ acceptAllAdvertisements: true });

    navigator.bluetooth.addEventListener('advertisementreceived', (e) => {
      if (!this._running) return;
      const parsed = parseManufacturerData(e.manufacturerData ?? null);
      const key = parsed.type === 'iBeacon' ? iBeaconKey(parsed) : `unk-${Date.now()}`;
      onAdvertisement({
        beaconKey:        key,
        rssi:             e.rssi ?? -100,
        timestamp:        Date.now(),
        manufacturerData: e.manufacturerData ?? null,
        serviceData:      e.serviceData ?? null,
        parsedType:       parsed.type,
        parsed,
        synthetic:        false,
        _raw:             e,
      });
    });
  }

  async _startWatchAdvertisements(onAdvertisement) {
    // Phương án dự phòng: người dùng chọn từng thiết bị trong hộp thoại trình duyệt.
    // Giới hạn: phải chọn từng thiết bị; thiết bị chỉ phát (không connectable) có thể không liệt kê được.
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalManufacturerData: [0x004C], // Apple (iBeacon)
    });

    if (!device.watchAdvertisements) {
      throw new Error('NO_WATCH_ADV: requestDevice có nhưng watchAdvertisements không khả dụng trên thiết bị này.');
    }

    this._devices.set(device.id, device);

    device.addEventListener('advertisementreceived', (e) => {
      if (!this._running) return;
      const parsed = parseManufacturerData(e.manufacturerData ?? null);
      const key = parsed.type === 'iBeacon' ? iBeaconKey(parsed) : `dev-${device.id.slice(0,8)}`;
      onAdvertisement({
        beaconKey:        key,
        rssi:             e.rssi ?? -100,
        timestamp:        Date.now(),
        manufacturerData: e.manufacturerData ?? null,
        serviceData:      e.serviceData ?? null,
        parsedType:       parsed.type,
        parsed,
        synthetic:        false,
        _raw:             e,
      });
    });

    await device.watchAdvertisements({ signal: this._abortCtrl?.signal });
  }

  /** Dừng quét. */
  stop() {
    this._running = false;
    try { this._scan?.stop(); } catch (_) { /* bỏ qua */ }
    for (const [, device] of this._devices) {
      try { device.unwatchAdvertisements?.(); } catch (_) { /* bỏ qua */ }
    }
    this._scan = null;
    this._devices.clear();
  }
}

// ─── Nguồn GIẢ LẬP ───────────────────────────────────────────────────────────

/**
 * Tạo số ngẫu nhiên có hạt giống cố định (seeded PRNG - mulberry32).
 * Đảm bảo tái lập kịch bản với cùng hạt giống.
 */
function seededRng(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tạo nhiễu Gaussian xấp xỉ (Box-Muller) dùng hàm RNG cho trước. */
function gaussianNoise(rng, std) {
  const u1 = rng() + 1e-10;
  const u2 = rng();
  return std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Các kịch bản giả lập (synthetic).
 * Mỗi kịch bản là hàm nhận (t_ms, beaconList, rng) và trả về mảng
 * { beaconKey, rssi } cho thời điểm t.
 */
export const SCENARIOS = {
  /** Đứng cạnh beacon 0 — tín hiệu ổn định, nhiễu nhỏ */
  'near-A': (t, beaconList, rng) => {
    return beaconList.map((b, i) => ({
      beaconKey: b.key,
      rssi: (i === 0 ? -58 : -85 - i * 3) + gaussianNoise(rng, 3),
    }));
  },

  /** Đi từ beacon 0 sang beacon 1 trong 20 giây */
  'A-to-B': (t, beaconList, rng) => {
    const pct = Math.min(1, t / 20_000); // 0→1 trong 20s
    return beaconList.map((b, i) => {
      let base;
      if (i === 0) base = -58 + pct * 30;       // A yếu dần
      else if (i === 1) base = -88 + pct * 30;   // B mạnh dần
      else base = -92 - i * 2;
      return { beaconKey: b.key, rssi: base + gaussianNoise(rng, 4) };
    });
  },

  /** Chồng lấn: 2 beacon mạnh gần bằng nhau */
  'overlap': (t, beaconList, rng) => {
    return beaconList.map((b, i) => ({
      beaconKey: b.key,
      rssi: (i < 2 ? -66 : -90 - i * 2) + gaussianNoise(rng, 5),
    }));
  },

  /** Mất tín hiệu hoàn toàn sau 5 giây */
  'lost': (t, beaconList, rng) => {
    if (t > 5_000) return []; // không phát gói nào
    return beaconList.map((b, i) => ({
      beaconKey: b.key,
      rssi: (i === 0 ? -60 : -88 - i * 2) + gaussianNoise(rng, 3),
    }));
  },

  /** Nhiễu RSSI cao — biến động lớn */
  'noisy': (t, beaconList, rng) => {
    return beaconList.map((b, i) => ({
      beaconKey: b.key,
      rssi: (i === 0 ? -62 : -87 - i * 2) + gaussianNoise(rng, 12),
    }));
  },
};

export const SCENARIO_LABELS = {
  'near-A':  'Đứng cạnh phòng A (tín hiệu ổn định)',
  'A-to-B':  'Đi từ phòng A sang phòng B (20 giây)',
  'overlap': 'Tín hiệu chồng giữa 2 phòng',
  'lost':    'Mất tín hiệu (sau 5 giây)',
  'noisy':   'RSSI nhiễu cao (biến động lớn)',
};

export class SimulatedSource {
  /**
   * @param {RoomMapEntry[]} beaconMap  — danh sách beacon cần phát
   * @param {string} [scenario]         — tên kịch bản trong SCENARIOS
   * @param {number} [intervalMs]       — chu kỳ phát (ms), mặc định 1000
   * @param {number} [seed]             — hạt giống ngẫu nhiên cố định (mặc định 42)
   */
  constructor(beaconMap = [], scenario = 'near-A', intervalMs = 1_000, seed = 42) {
    this.type = 'simulated';
    this._beaconList = beaconMap.map(e => ({ key: e.beaconKey, roomId: e.roomId }));
    this._scenario   = scenario;
    this._intervalMs = intervalMs;
    this._seed       = seed;
    this._timer      = null;
    this._startTime  = null;
  }

  setScenario(scenario) { this._scenario = scenario; }
  setSeed(seed)         { this._seed = seed; }

  start(onAdvertisement) {
    if (this._timer) this.stop();
    this._startTime = Date.now();
    const rng = seededRng(this._seed);
    const scenarioFn = SCENARIOS[this._scenario] ?? SCENARIOS['near-A'];

    this._timer = setInterval(() => {
      const t = Date.now() - this._startTime;
      const packets = scenarioFn(t, this._beaconList, rng);

      for (const pkt of packets) {
        // Tạo manufacturerData giả từ beaconKey dạng "uuid-major-minor"
        // Với placeholder key 'PLACEHOLDER-xxx-major-minor' — chỉ tạo raw map đơn giản
        let manufacturerData = null;
        try {
          const parts = pkt.beaconKey.split('-');
          // Thử tạo iBeacon data nếu beaconKey có dạng UUID-major-minor
          // UUID 8-4-4-4-12 → 5 phần, sau đó major, minor
          if (parts.length >= 6) {
            const uuid  = parts.slice(0, 5).join('-');
            const major = parseInt(parts[5], 10);
            const minor = parseInt(parts[6] ?? '0', 10);
            if (!isNaN(major) && !isNaN(minor)) {
              manufacturerData = buildIBeaconManufacturerData(uuid, major, minor, -59);
            }
          }
        } catch (_) { /* bỏ qua — key không phải UUID chuẩn */ }

        onAdvertisement({
          beaconKey:        pkt.beaconKey,
          rssi:             Math.round(pkt.rssi * 10) / 10,
          timestamp:        Date.now(),
          manufacturerData,
          serviceData:      null,
          parsedType:       'iBeacon',
          parsed:           { type: 'iBeacon-synthetic' },
          synthetic:        true,
          scenario:         this._scenario,
        });
      }
    }, this._intervalMs);
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._startTime = null;
  }
}
