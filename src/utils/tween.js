/**
 * tween.js – Module tween nội bộ nhỏ, không cần cài gói ngoài.
 * Hỗ trợ: easing functions, hủy được, callback onUpdate/onComplete.
 */

// ─── Easing functions ─────────────────────────────────────────────────────────
export const Easing = {
  linear: t => t,
  easeIn:  t => t * t,
  easeOut: t => t * (2 - t),
  easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOutBack: t => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeOutBounce: t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1)       return n1 * t * t;
    if (t < 2 / d1)       return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1)     return n1 * (t -= 2.25 / d1) * t + 0.9375;
                           return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

// ─── Tween class ──────────────────────────────────────────────────────────────
export class Tween {
  /**
   * @param {object} opts
   * @param {number|object} opts.from  – giá trị bắt đầu (số hoặc {x,y,z,...})
   * @param {number|object} opts.to    – giá trị kết thúc
   * @param {number}        opts.duration – mili giây
   * @param {function}      opts.easing  – hàm easing (mặc định easeInOut)
   * @param {function}      opts.onUpdate(value, progress) – gọi mỗi frame
   * @param {function}      opts.onComplete() – gọi khi xong
   */
  constructor({ from, to, duration = 300, easing = Easing.easeInOut, onUpdate, onComplete } = {}) {
    this.from       = from;
    this.to         = to;
    this.duration   = duration;
    this.easing     = easing;
    this.onUpdate   = onUpdate;
    this.onComplete = onComplete;
    this._startTime = null;
    this._cancelled = false;
    this._done      = false;
  }

  start(nowMs) {
    this._startTime = nowMs;
    this._cancelled = false;
    this._done = false;
    return this;
  }

  cancel() {
    this._cancelled = true;
  }

  get done() { return this._done || this._cancelled; }

  update(nowMs) {
    if (this._cancelled || this._done) return;
    if (this._startTime === null) this._startTime = nowMs;

    const elapsed = nowMs - this._startTime;
    const rawT = Math.min(elapsed / this.duration, 1);
    const t = this.easing(rawT);

    const value = this._interpolate(this.from, this.to, t);
    this.onUpdate?.(value, rawT);

    if (rawT >= 1) {
      this._done = true;
      this.onComplete?.();
    }
  }

  _interpolate(from, to, t) {
    if (typeof from === 'number') return from + (to - from) * t;
    // Xử lý object {x,y,z,...}
    const result = {};
    for (const k of Object.keys(from)) {
      result[k] = from[k] + (to[k] - from[k]) * t;
    }
    return result;
  }
}

// ─── TweenManager – cập nhật tất cả tween mỗi frame ─────────────────────────
export class TweenManager {
  constructor() {
    this._tweens = [];
  }

  add(tween, nowMs) {
    tween.start(nowMs ?? performance.now());
    this._tweens.push(tween);
    return tween;
  }

  update(nowMs) {
    let hasActive = false;
    for (let i = this._tweens.length - 1; i >= 0; i--) {
      const tw = this._tweens[i];
      if (tw.done) {
        this._tweens.splice(i, 1);
      } else {
        tw.update(nowMs);
        if (tw.done) {
          this._tweens.splice(i, 1);
        } else {
          hasActive = true;
        }
      }
    }
    return hasActive;
  }

  cancelAll() {
    for (const tw of this._tweens) tw.cancel();
    this._tweens = [];
  }

  get count() { return this._tweens.length; }
}
