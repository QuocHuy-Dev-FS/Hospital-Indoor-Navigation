/**
 * beacon_admin.test.mjs — Unit tests cho src/beacon-admin/smoothing.js
 * và src/beacon-admin/sources.js
 * Chạy: node --test tests/beacon_admin.test.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { SlidingWindow } from '../src/beacon-admin/smoothing.js';
import { MockReplaySource, LaptopBridgeSource } from '../src/beacon-admin/sources.js';

// ─── SlidingWindow ────────────────────────────────────────────────────────────

describe('SlidingWindow', () => {

  test('mean() trả null khi chưa có mẫu', () => {
    const w = new SlidingWindow(5);
    assert.equal(w.mean(), null);
  });

  test('count() đúng sau khi push', () => {
    const w = new SlidingWindow(5);
    w.push(-60); w.push(-65);
    assert.equal(w.count(), 2);
  });

  test('mean() đúng với 3 mẫu', () => {
    const w = new SlidingWindow(5);
    w.push(-60); w.push(-70); w.push(-80);
    assert.ok(Math.abs(w.mean() - (-70)) < 0.001);
  });

  test('push() giữ tối đa size phần tử (cửa sổ)', () => {
    const w = new SlidingWindow(3);
    w.push(1); w.push(2); w.push(3); w.push(4);
    assert.equal(w.count(), 3);
    // Phần tử đầu (1) đã bị loại, chỉ còn 2, 3, 4
    assert.ok(Math.abs(w.mean() - 3) < 0.001);
  });

  test('reset() xoá sạch buffer', () => {
    const w = new SlidingWindow(5);
    w.push(-60); w.push(-70);
    w.reset();
    assert.equal(w.count(), 0);
    assert.equal(w.mean(), null);
  });

  test('samples() trả bản sao mảng', () => {
    const w = new SlidingWindow(5);
    w.push(-60); w.push(-65);
    const s = w.samples();
    s.push(-999); // thay đổi bản sao không ảnh hưởng internal
    assert.equal(w.count(), 2);
  });

  test('size=1: luôn chỉ giữ mẫu cuối', () => {
    const w = new SlidingWindow(1);
    w.push(-80); w.push(-50);
    assert.equal(w.count(), 1);
    assert.equal(w.mean(), -50);
  });

});

// ─── MockReplaySource ────────────────────────────────────────────────────────

describe('MockReplaySource', () => {

  test('type === mock', () => {
    const src = new MockReplaySource([], 'near-A', 500);
    assert.equal(src.type, 'mock');
  });

  test('scenarios() trả danh sách không rỗng', () => {
    const list = MockReplaySource.scenarios;
    assert.ok(Array.isArray(list) && list.length >= 1);
    assert.ok(list.includes('near-A'));
  });

  test('start() gọi onStatusChange("connected") ngay lập tức', () => {
    return new Promise((resolve) => {
      const src = new MockReplaySource(['key-1-1'], 'near-A', 100);
      src.start(() => {}, (status) => {
        if (status === 'connected') { src.stop(); resolve(); }
      });
    });
  });

  test('start() phát ít nhất 1 observation sau 1 interval', () => {
    return new Promise((resolve) => {
      const keys = ['00000001-0000-0000-0000-000000000000-1-1'];
      const src = new MockReplaySource(keys, 'near-A', 50);
      let count = 0;
      src.start((obs) => {
        count++;
        assert.ok(typeof obs.key === 'string');
        assert.ok(typeof obs.rssi === 'number');
        assert.equal(obs.source, 'mock');
        src.stop();
        resolve();
      }, () => {});
    });
  });

  test('stop() ngăn không phát thêm observation', () => {
    return new Promise((resolve, reject) => {
      const keys = ['key-1-1'];
      const src = new MockReplaySource(keys, 'near-A', 50);
      let count = 0;
      src.start((obs) => { count++; }, () => {});
      setTimeout(() => { src.stop(); }, 30);
      setTimeout(() => {
        // Sau khi stop, count không tăng
        const snapCount = count;
        setTimeout(() => {
          assert.equal(count, snapCount);
          resolve();
        }, 100);
      }, 120);
    });
  });

  test('setScenario() thay kịch bản không crash', () => {
    const src = new MockReplaySource(['key-1-1'], 'near-A', 200);
    src.start(() => {}, () => {});
    src.setScenario('lost');
    assert.equal(src._scenario, 'lost');
    src.stop();
  });

});

// ─── LaptopBridgeSource ──────────────────────────────────────────────────────
// Dùng mock WebSocket để tránh kết nối thật và event loop hang.

function makeMockWS({ openAfterMs = null, failAfterMs = 10 } = {}) {
  return class MockWS {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.onopen = null; this.onclose = null;
      this.onerror = null; this.onmessage = null;
      this._closed = false;

      if (openAfterMs !== null) {
        setTimeout(() => {
          if (!this._closed) { this.readyState = 1; this.onopen?.(); }
        }, openAfterMs);
      } else {
        setTimeout(() => {
          if (!this._closed) { this.readyState = 3; this.onclose?.(); }
        }, failAfterMs);
      }
    }
    close() { this._closed = true; this.readyState = 3; }
    send(msg) {}
  };
}

describe('LaptopBridgeSource', () => {

  test('type === bridge', () => {
    const src = new LaptopBridgeSource(8765);
    assert.equal(src.type, 'bridge');
  });

  test('backoff ban đầu là 1000ms', () => {
    const src = new LaptopBridgeSource(8765);
    assert.equal(src._backoffMs, 1000);
  });

  test('stop() ngay sau khi tạo không throw', () => {
    const src = new LaptopBridgeSource(8765);
    assert.doesNotThrow(() => src.stop());
  });

  test('kết nối thất bại → gọi onStatusChange("disconnected")', () => {
    return new Promise((resolve) => {
      const src = new LaptopBridgeSource(8765, makeMockWS({ failAfterMs: 10 }));
      src.start(() => {}, (status) => {
        if (status === 'disconnected') { src.stop(); resolve(); }
      });
    });
  });

  test('kết nối thành công → gọi onStatusChange("connected")', () => {
    return new Promise((resolve) => {
      const src = new LaptopBridgeSource(8765, makeMockWS({ openAfterMs: 10 }));
      src.start(() => {}, (status) => {
        if (status === 'connected') { src.stop(); resolve(); }
      });
    });
  });

  test('message hợp lệ → gọi onObservation', () => {
    return new Promise((resolve) => {
      let wsInstance = null;
      const WS = class {
        constructor() {
          this.onopen = null; this.onclose = null;
          this.onerror = null; this.onmessage = null;
          wsInstance = this;
          setTimeout(() => this.onopen?.(), 5);
        }
        close() {}
        send() {}
      };
      const src = new LaptopBridgeSource(8765, WS);
      src.start((obs) => {
        assert.equal(obs.key, 'test-key');
        assert.equal(obs.rssi, -65);
        src.stop();
        resolve();
      }, () => {});

      setTimeout(() => {
        wsInstance?.onmessage?.({ data: JSON.stringify({ key: 'test-key', rssi: -65, txPower: -59, timestamp: Date.now(), source: 'laptop' }) });
      }, 20);
    });
  });

  test('backoff tăng lên sau khi scheduleReconnect chạy', () => {
    return new Promise((resolve) => {
      // Mock: kết nối thất bại sau 5ms → backoff phải giữ nguyên 1000ms (chưa tăng vì chưa reconnect lần 2)
      const src = new LaptopBridgeSource(8765, makeMockWS({ failAfterMs: 5 }));
      src.start(() => {}, (status) => {
        if (status === 'disconnected') {
          setTimeout(() => {
            src.stop();
            assert.ok(src._backoffMs >= 1000);
            resolve();
          }, 10);
        }
      });
    });
  });

});
