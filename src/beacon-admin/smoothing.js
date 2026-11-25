/**
 * smoothing.js — Cửa sổ trượt (sliding window) làm mượt RSSI.
 * Không phụ thuộc thư viện, dùng được cả trình duyệt lẫn Node test.
 */

export class SlidingWindow {
  /** @param {number} size số mẫu tối đa */
  constructor(size = 5) {
    this._size = size;
    this._buf  = [];
  }

  /** Thêm một giá trị mới vào cửa sổ. */
  push(value) {
    this._buf.push(value);
    if (this._buf.length > this._size) this._buf.shift();
  }

  /** Trả về trung bình cộng, hoặc null nếu chưa có mẫu nào. */
  mean() {
    if (this._buf.length === 0) return null;
    return this._buf.reduce((a, b) => a + b, 0) / this._buf.length;
  }

  /** Số mẫu hiện có trong cửa sổ. */
  count() { return this._buf.length; }

  /** Xoá toàn bộ mẫu. */
  reset() { this._buf = []; }

  /** Sao chép mảng mẫu (dùng cho CalibrationRecord). */
  samples() { return [...this._buf]; }
}
