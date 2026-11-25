/**
 * tests/map2d.test.mjs
 * Unit tests: metersToSVG (Map2D.js), hasWebGL (QualityManager.js, mock DOM)
 * Chạy: node --test tests/map2d.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ─── Import các module cần test ───────────────────────────────────────────────
import { metersToSVG, MAP2D_SCALE } from '../src/map2d/Map2D.js';
import { QualityManager } from '../src/quality/QualityManager.js';

// ─── Test: metersToSVG ────────────────────────────────────────────────────────
describe('metersToSVG', () => {
  test('tọa độ gốc (0,0) → SVG (0,0)', () => {
    const r = metersToSVG(0, 0);
    assert.equal(r.x, 0);
    assert.equal(r.y, 0);
  });

  test('x=3.38, z=3.12 → x=33.8, y=31.2 (centroid F1_R001)', () => {
    const r = metersToSVG(3.38, 3.12);
    assert.ok(Math.abs(r.x - 33.8) < 0.001, `x=${r.x} phải ~33.8`);
    assert.ok(Math.abs(r.y - 31.2) < 0.001, `y=${r.y} phải ~31.2`);
  });

  test('tọa độ góc phải-dưới toà nhà: x=34.92, z=41.92', () => {
    const r = metersToSVG(34.92, 41.92);
    assert.ok(Math.abs(r.x - 349.2) < 0.001);
    assert.ok(Math.abs(r.y - 419.2) < 0.001);
  });

  test('scale tùy chỉnh', () => {
    const r = metersToSVG(1, 2, 5);
    assert.equal(r.x, 5);
    assert.equal(r.y, 10);
  });

  test('MAP2D_SCALE là số dương', () => {
    assert.ok(typeof MAP2D_SCALE === 'number');
    assert.ok(MAP2D_SCALE > 0);
  });
});

// ─── Test: QualityManager.hasWebGL (mock document) ───────────────────────────
// Node.js 18+: navigator là read-only getter → dùng Object.defineProperty để mock.
describe('QualityManager.hasWebGL', () => {
  function mockEnv(fakeDocument) {
    Object.defineProperty(globalThis, 'document',  { value: fakeDocument, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'test-ua' }, configurable: true, writable: true });
  }
  function restoreEnv() {
    Object.defineProperty(globalThis, 'document',  { value: undefined, configurable: true, writable: true });
    // Restore navigator bằng cách delete để Node khôi phục getter gốc
    try { delete globalThis.navigator; } catch { /* không làm được trên một số env */ }
  }

  test('trả true khi getContext("webgl2") trả về object', () => {
    mockEnv({ createElement: (_tag) => ({ getContext: (t) => t === 'webgl2' ? { isWebGL2: true } : null }) });
    const result = QualityManager.hasWebGL();
    restoreEnv();
    assert.equal(result, true);
  });

  test('trả true khi webgl2=null nhưng webgl trả về object', () => {
    let callCount = 0;
    mockEnv({
      createElement: (_tag) => ({
        getContext: (t) => { callCount++; if (t === 'webgl2') return null; if (t === 'webgl') return { isWebGL: true }; return null; },
      }),
    });
    const result = QualityManager.hasWebGL();
    restoreEnv();
    assert.equal(result, true, 'Phải true khi webgl khả dụng dù webgl2 không');
    assert.ok(callCount >= 2, `getContext phải gọi ít nhất 2 lần, thực tế: ${callCount}`);
  });

  test('trả false khi tất cả getContext trả null', () => {
    mockEnv({ createElement: (_tag) => ({ getContext: (_t) => null }) });
    const result = QualityManager.hasWebGL();
    restoreEnv();
    assert.equal(result, false);
  });

  test('trả false khi getContext() throw', () => {
    mockEnv({ createElement: (_tag) => ({ getContext: (_t) => { throw new Error('SecurityError'); } }) });
    const result = QualityManager.hasWebGL();
    restoreEnv();
    assert.equal(result, false);
  });

  test('canvas mới cho mỗi type: webgl2=null không ngăn webgl thành công', () => {
    // Mô phỏng lỗi Chromium: canvas bị "khóa" type sau lần gọi đầu,
    // nhưng code mới dùng canvas riêng → lần 2 thành công.
    const log = [];
    mockEnv({
      createElement: (_tag) => {
        const id = log.length;
        log.push({ id, calls: [] });
        return {
          getContext: (t) => {
            log[id].calls.push(t);
            if (id === 0) return null;           // canvas 0 (thử webgl2): null
            if (id === 1) return { isWebGL: true }; // canvas 1 (thử webgl): OK
            return null;
          },
        };
      },
    });
    const result = QualityManager.hasWebGL();
    restoreEnv();
    assert.equal(result, true, 'Canvas riêng → webgl thành công dù webgl2 canvas thất bại');
    assert.ok(log.length >= 2, 'Phải tạo ít nhất 2 canvas');
    assert.equal(log[0].calls.length, 1, 'Canvas 0 chỉ gọi getContext 1 lần');
    assert.equal(log[1].calls.length, 1, 'Canvas 1 chỉ gọi getContext 1 lần');
  });
});
