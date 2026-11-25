/**
 * QualityManager.js
 * Hệ thống tier chất lượng: low / medium / high
 * Phát hiện khả năng thiết bị → chọn tier ban đầu → tự hạ nếu FPS thấp.
 * Ngưỡng: giá trị khởi đầu – Cần xác nhận bằng đo thực tế.
 */

// ─── Ngưỡng phát hiện (Cần xác nhận) ──────────────────────────────────────────
const THRESH = {
  HIGH_DPR: 1.9,      // DPR tối thiểu để xét high (Cần xác nhận)
  HIGH_CORES: 4,      // hardwareConcurrency tối thiểu (Cần xác nhận)
  HIGH_MEM: 4,        // deviceMemory (GB) tối thiểu (Cần xác nhận)
  LOW_CORES: 2,       // cores ≤ này → xét low (Cần xác nhận)
  LOW_MEM: 2,         // deviceMemory ≤ này → xét low (Cần xác nhận)
  FPS_DROP_HIGH: 45,  // FPS < này → hạ high→medium (Cần xác nhận)
  FPS_DROP_MED: 30,   // FPS < này → hạ medium→low (Cần xác nhận)
  FPS_DPR_DROP: 25,   // FPS < này → hạ DPR thêm (Cần xác nhận)
  FPS_MEASURE_MS: 2500, // Đo FPS trong bao lâu trước khi quyết định (Cần xác nhận)
};

export class QualityManager {
  constructor() {
    this.tier = this._detectInitialTier();
    this._savingMode = localStorage.getItem('savingMode') === '1';
    if (this._savingMode) this.tier = 'low';

    this._renderPending = false;
    this._onRenderCallbacks = [];
    this._animating = false; // true khi có tween/animation đang chạy
    this._hidden = false;

    this._fpsSamples = [];
    this._fpsMeasuring = false;
    this._fpsDone = false;
    this._lastFpsTime = 0;

    document.addEventListener('visibilitychange', () => {
      this._hidden = document.hidden;
      if (!this._hidden) this.requestRender();
    });
  }

  _detectInitialTier() {
    if (typeof window === 'undefined') return 'medium';

    const dpr = window.devicePixelRatio ?? 1;
    const cores = navigator.hardwareConcurrency ?? 4;
    const mem = navigator.deviceMemory ?? 4; // không có trên Firefox → default 4

    // Phát hiện WebGL2
    let gl2 = false;
    try {
      const c = document.createElement('canvas');
      gl2 = !!(c.getContext('webgl2'));
    } catch { /* ignore */ }

    // Điều kiện low
    if (!gl2 || dpr <= 1 || cores <= THRESH.LOW_CORES || mem <= THRESH.LOW_MEM) {
      return 'low';
    }
    // Điều kiện high
    if (dpr >= THRESH.HIGH_DPR && cores >= THRESH.HIGH_CORES && mem >= THRESH.HIGH_MEM) {
      return 'high';
    }
    return 'medium';
  }

  // ─── Kiểm tra WebGL có hoạt động không ─────────────────────────────────────
  // Mỗi lần thử dùng canvas mới để tránh lỗi canvas bị "khóa" context type
  // trên một số Chromium (getContext thứ hai trên cùng canvas trả null dù GPU OK).
  static hasWebGL() {
    const ua = (typeof navigator !== 'undefined') ? navigator.userAgent : '(no navigator)';
    for (const type of ['webgl2', 'webgl', 'experimental-webgl']) {
      try {
        const c = document.createElement('canvas');
        const ctx = c.getContext(type);
        if (ctx) return true;
      } catch (e) {
        console.warn(`[WebGL] getContext('${type}') threw:`, e.message, '| UA:', ua);
      }
    }
    console.warn('[WebGL] Tất cả context types (webgl2/webgl/experimental-webgl) thất bại. UA:', ua);
    return false;
  }

  // ─── Cấu hình renderer theo tier ───────────────────────────────────────────
  applyToRenderer(renderer) {
    const dprMap = { low: 1, medium: Math.min(window.devicePixelRatio, 1.5), high: Math.min(window.devicePixelRatio, 2) };
    renderer.setPixelRatio(dprMap[this.tier]);

    if (this.tier !== 'low') {
      renderer.shadowMap.enabled = true;
    } else {
      renderer.shadowMap.enabled = false;
    }
  }

  // ─── Cấu hình scene (lights, fog) theo tier ────────────────────────────────
  getTierConfig() {
    const configs = {
      low: {
        useFog: false,
        useEdges: false,
        shadowMapSize: 0,
        useHemisphere: false,
        usePostProcessing: false,
        useOutline: false,
        useRouteShader: false,
        ambientIntensity: 1.2,
        dirIntensity: 0.5,
      },
      medium: {
        useFog: true,
        useEdges: true,
        shadowMapSize: 512,  // Cần xác nhận
        useHemisphere: true,
        usePostProcessing: true,  // FXAA
        useOutline: false,
        useRouteShader: true,
        ambientIntensity: 0,   // hemisphere thay thế ambient
        dirIntensity: 0.8,
      },
      high: {
        useFog: true,
        useEdges: true,
        shadowMapSize: 1024, // Cần xác nhận
        useHemisphere: true,
        usePostProcessing: true, // FXAA + OutlinePass
        useOutline: true,
        useRouteShader: true,
        ambientIntensity: 0,
        dirIntensity: 0.8,
      },
    };
    return configs[this.tier];
  }

  // ─── FPS measurement & auto-downgrade ──────────────────────────────────────
  startFpsMeasure() {
    if (this._fpsDone) return;
    this._fpsMeasuring = true;
    this._fpsSamples = [];
    this._lastFpsTime = performance.now();
  }

  recordFrame(nowMs) {
    if (!this._fpsMeasuring || this._fpsDone) return;
    const dt = nowMs - this._lastFpsTime;
    this._lastFpsTime = nowMs;
    if (dt > 0 && dt < 500) this._fpsSamples.push(1000 / dt);

    if (nowMs - (this._fpsMeasureStart ?? nowMs) > THRESH.FPS_MEASURE_MS && this._fpsSamples.length >= 10) {
      this._fpsDone = true;
      this._fpsMeasuring = false;
      this._autoDowngrade();
    }
    if (!this._fpsMeasureStart) this._fpsMeasureStart = nowMs;
  }

  _autoDowngrade() {
    const avg = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
    const prev = this.tier;

    if (this.tier === 'high' && avg < THRESH.FPS_DROP_HIGH) {
      this.tier = 'medium';
    }
    if (this.tier === 'medium' && avg < THRESH.FPS_DROP_MED) {
      this.tier = 'low';
    }

    if (this.tier !== prev) {
      this._onTierChange?.(this.tier, prev, avg);
    }
  }

  onTierChange(fn) { this._onTierChange = fn; }

  // ─── Saving mode ────────────────────────────────────────────────────────────
  get savingMode() { return this._savingMode; }
  setSavingMode(on) {
    this._savingMode = on;
    localStorage.setItem('savingMode', on ? '1' : '0');
    if (on) this.tier = 'low';
  }

  // ─── Render-on-demand ────────────────────────────────────────────────────────
  requestRender() {
    this._renderPending = true;
  }

  setAnimating(on) {
    this._animating = on;
    if (on) this._renderPending = true;
  }

  shouldRender() {
    if (this._hidden) return false;
    if (this._animating) { this._renderPending = true; return true; }
    if (this._renderPending) { this._renderPending = false; return true; }
    return false;
  }
}

export const QUALITY_THRESHOLDS = THRESH;
