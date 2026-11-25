/**
 * sources.js — Nguồn dữ liệu beacon cho trang quản trị kỹ thuật viên.
 *
 * Interface BeaconObservation:
 *   { key: string, rssi: number, txPower: number, timestamp: number, source: string }
 *
 * LaptopBridgeSource  — kết nối WebSocket tới Python bridge (ws://127.0.0.1:PORT)
 * MockReplaySource    — phát lại kịch bản giả lập (không cần bridge, dùng khi test)
 */

// ─── LaptopBridgeSource ───────────────────────────────────────────────────────

export class LaptopBridgeSource {
  /**
   * @param {number} port cổng WebSocket của bridge (mặc định 8765)
   * @param {typeof WebSocket} [_WS] WebSocket constructor (dùng mock trong test)
   */
  constructor(port = 8765, _WS = null) {
    this._port        = port;
    this._WS          = _WS ?? (typeof WebSocket !== 'undefined' ? WebSocket : null);
    this._ws          = null;
    this._onObs       = null;
    this._onStatus    = null;
    this._backoffMs   = 1000;
    this._maxBackoff  = 30_000;
    this._timer       = null;
    this._stopped     = false;
    this.type         = 'bridge';
  }

  /**
   * Bắt đầu kết nối và lắng nghe observation.
   * @param {(obs: object) => void} onObservation
   * @param {(status: string) => void} onStatusChange  'connecting'|'connected'|'disconnected'
   */
  start(onObservation, onStatusChange) {
    this._onObs    = onObservation;
    this._onStatus = onStatusChange;
    this._stopped  = false;
    this._connect();
  }

  stop() {
    this._stopped = true;
    clearTimeout(this._timer);
    this._ws?.close();
    this._ws = null;
  }

  _connect() {
    if (this._stopped) return;
    if (!this._WS) { this._onStatus?.('disconnected'); return; }
    this._onStatus?.('connecting');
    const ws = new this._WS(`ws://127.0.0.1:${this._port}`);

    ws.onopen = () => {
      this._backoffMs = 1000;
      this._onStatus?.('connected');
    };

    ws.onmessage = (e) => {
      let data;
      try { data = JSON.parse(e.data); } catch { return; }
      if (!data.key || data.rssi === undefined) return;
      this._onObs?.(data);
    };

    ws.onerror = () => {};  // onclose xử lý

    ws.onclose = () => {
      this._ws = null;
      if (this._stopped) return;
      this._onStatus?.('disconnected');
      this._scheduleReconnect();
    };

    this._ws = ws;
  }

  _scheduleReconnect() {
    if (this._stopped) return;
    this._timer = setTimeout(() => {
      this._backoffMs = Math.min(this._backoffMs * 2, this._maxBackoff);
      this._connect();
    }, this._backoffMs);
  }
}


// ─── MockReplaySource ─────────────────────────────────────────────────────────

const MOCK_SCENARIOS = {
  /** Một beacon liên tục mạnh */
  'near-A': (keys, t) => [
    { key: keys[0], rssi: -60 + (Math.random() * 4 - 2) },
  ],

  /** Beacon A → B theo thời gian (chuyển dần sau 5s) */
  'A-to-B': (keys, t) => {
    const frac = Math.min(t / 5000, 1);
    return [
      { key: keys[0], rssi: -60 - frac * 20 + (Math.random() * 4 - 2) },
      { key: keys[1], rssi: -80 + frac * 20 + (Math.random() * 4 - 2) },
    ];
  },

  /** Hai beacon mạnh như nhau */
  'overlap': (keys, t) => [
    { key: keys[0], rssi: -65 + (Math.random() * 6 - 3) },
    { key: keys[1], rssi: -65 + (Math.random() * 6 - 3) },
  ],

  /** Tất cả mất tín hiệu sau 3s */
  'lost': (keys, t) => {
    if (t < 3000) return [{ key: keys[0], rssi: -60 }];
    return [];
  },

  /** Tín hiệu rất nhiễu */
  'noisy': (keys, t) => [
    { key: keys[0], rssi: -65 + (Math.random() * 30 - 15) },
  ],
};

export class MockReplaySource {
  /**
   * @param {string[]} beaconKeys  mảng key để phát ra (lấy từ beacons.json)
   * @param {string}   scenario    tên kịch bản trong MOCK_SCENARIOS
   * @param {number}   intervalMs  khoảng thời gian giữa mỗi đợt phát (ms)
   */
  constructor(beaconKeys = [], scenario = 'near-A', intervalMs = 1000) {
    this._keys       = beaconKeys;
    this._scenario   = scenario;
    this._intervalMs = intervalMs;
    this._timer      = null;
    this._startTime  = null;
    this._onObs      = null;
    this._onStatus   = null;
    this.type        = 'mock';
  }

  /** Danh sách tên kịch bản có sẵn. */
  static get scenarios() { return Object.keys(MOCK_SCENARIOS); }

  start(onObservation, onStatusChange) {
    this._onObs    = onObservation;
    this._onStatus = onStatusChange;
    this._startTime = Date.now();
    this._onStatus?.('connected');

    this._timer = setInterval(() => {
      const t = Date.now() - this._startTime;
      const fn = MOCK_SCENARIOS[this._scenario] ?? MOCK_SCENARIOS['near-A'];
      const packets = fn(this._keys, t);
      for (const pkt of packets) {
        this._onObs?.({
          key:       pkt.key,
          rssi:      Math.round(pkt.rssi),
          txPower:   -59,
          timestamp: Date.now(),
          source:    'mock',
        });
      }
    }, this._intervalMs);
  }

  stop() {
    clearInterval(this._timer);
    this._timer = null;
  }

  /** Thay kịch bản đang chạy (không cần stop/start lại). */
  setScenario(name) {
    if (name in MOCK_SCENARIOS) this._scenario = name;
  }
}
