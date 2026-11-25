/**
 * bridge_source.js — Nhận vị trí từ cầu nối BLE laptop qua relay HTTP.
 *
 * Luồng:
 *   1. Laptop mở trang quét (scan/index.html), nhận mã 6 số từ /api/loc/new-code.
 *   2. Laptop kết nối bridge.py (WebSocket ws://127.0.0.1:8765), xử lý beacon → roomId.
 *   3. Laptop POST {code, roomId, floorId, confidence, timestamp} → /api/loc/push.
 *   4. Điện thoại dùng BridgeSource.start(code, ...) → polling /api/loc/poll?code=XXXX.
 *
 * Chỉ gửi {roomId, floorId, confidence, timestamp} — không lưu dữ liệu vị trí.
 */

// Giá trị ngưỡng (Cần xác nhận sau đo thực địa)
const POLL_INTERVAL_MS  = 2_000;   // Cần xác nhận: tần suất polling
const SIGNAL_TIMEOUT_MS = 15_000;  // Cần xác nhận: quá N giây không có dữ liệu → lost

export class BridgeSource {
  constructor({ pollIntervalMs = POLL_INTERVAL_MS, timeoutMs = SIGNAL_TIMEOUT_MS } = {}) {
    this._pollMs    = pollIntervalMs;
    this._timeoutMs = timeoutMs;
    this._code      = null;
    this._timer     = null;
    this._onPos     = null;
    this._onStatus  = null;
    this._lastTs    = 0;
    this._isLost    = false;
    this.type       = 'bridge';
  }

  /** Lấy mã ghép cặp mới từ server. Gọi trước start(). */
  async fetchCode() {
    const res = await fetch('/api/loc/new-code', { method: 'POST' });
    if (!res.ok) throw new Error(`Không lấy được mã ghép cặp (HTTP ${res.status})`);
    const { code } = await res.json();
    this._code = code;
    return code;
  }

  /** Bắt đầu polling. code: mã 6 số hiện trên trang quét laptop. */
  start(code, onPosition, onStatus) {
    if (this._timer) this.stop();
    this._code    = code;
    this._onPos   = onPosition;
    this._onStatus = onStatus;
    this._isLost  = false;
    this._lastTs  = 0;
    this._onStatus?.('connecting');
    this._timer = setInterval(() => this._poll(), this._pollMs);
    this._poll(); // poll ngay lập tức lần đầu
  }

  stop() {
    clearInterval(this._timer);
    this._timer = null;
  }

  get code() { return this._code; }

  async _poll() {
    if (!this._code) return;
    try {
      const res = await fetch(`/api/loc/poll?code=${encodeURIComponent(this._code)}`);
      if (!res.ok) return;
      const data = await res.json();

      if (!data.found || !data.roomId) {
        // Chưa có dữ liệu — kiểm tra timeout nếu đã từng có
        if (this._lastTs > 0 && Date.now() - this._lastTs > this._timeoutMs) {
          if (!this._isLost) { this._isLost = true; this._onStatus?.('lost'); }
        }
        return;
      }

      const age = Date.now() - (data.timestamp ?? Date.now());
      if (age > this._timeoutMs) {
        if (!this._isLost) { this._isLost = true; this._onStatus?.('lost'); }
        return;
      }

      this._lastTs = data.timestamp ?? Date.now();
      this._isLost = false;
      this._onStatus?.('active');
      this._onPos?.({
        roomId:     data.roomId,
        floorId:    data.floorId ?? data.roomId.split('_')[0],
        confidence: data.confidence ?? 1,
        timestamp:  data.timestamp ?? Date.now(),
      });
    } catch {
      // Network error — không thay đổi trạng thái, chờ lần tiếp theo
    }
  }
}
