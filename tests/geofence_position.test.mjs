import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateGeofence, checkCampus, geofenceMessage, loadGeofenceConfig } from '../src/positioning/geofence.js';
import { createPositionProvider, CONFIDENCE_MIN, STALE_MS } from '../src/positioning/position_provider.js';

// Tọa độ giả (hình vuông quanh (0,0)); KHÔNG phải tọa độ thật.
const SQUARE = { status: 'configured', type: 'polygon', polygon: [[-1, -1], [-1, 1], [1, 1], [1, -1]] };
const CIRCLE = { status: 'configured', type: 'circle', center: [0, 0], radius_m: 1000 };

function fakeGeo({ coords, error } = {}) {
  const g = { calls: 0, lastOptions: null };
  g.getCurrentPosition = (ok, fail, opts) => {
    g.calls++;
    g.lastOptions = opts;
    if (error) fail(error); else ok({ coords });
  };
  return g;
}

test('geofence: polygon trong/ngoài, chưa cấu hình, polygon < 3 đỉnh, circle', async () => {
  assert.equal(evaluateGeofence(SQUARE, { lat: 0, lng: 0 }), 'inside');
  assert.equal(evaluateGeofence(SQUARE, { lat: 5, lng: 5 }), 'outside');
  const real = JSON.parse(await readFile(new URL('../data/geofence.json', import.meta.url)));
  assert.equal(real.status, 'unconfigured');
  assert.equal(evaluateGeofence(real, { lat: 0, lng: 0 }), 'unconfigured');
  assert.equal(evaluateGeofence({ status: 'configured', type: 'polygon', polygon: [[0, 0], [1, 1]] }, { lat: 0, lng: 0 }), 'unconfigured');
  assert.equal(evaluateGeofence({ status: 'configured', type: 'circle', center: null, radius_m: 10 }, { lat: 0, lng: 0 }), 'unconfigured');
  assert.equal(evaluateGeofence({ status: 'configured', type: 'circle', center: [0, 0], radius_m: 0 }, { lat: 0, lng: 0 }), 'unconfigured');
  assert.equal(evaluateGeofence(CIRCLE, { lat: 0.005, lng: 0 }), 'inside');   // ~556 m
  assert.equal(evaluateGeofence(CIRCLE, { lat: 0.02, lng: 0 }), 'outside');   // ~2224 m
});

test('loadGeofenceConfig: lỗi tải -> unconfigured', async () => {
  const cfg = await loadGeofenceConfig(async () => { throw new Error('404'); });
  assert.equal(cfg.status, 'unconfigured');
});

test('checkCampus: chưa cấu hình thì KHÔNG gọi geolocation (bộ đếm = 0)', async () => {
  const geo = fakeGeo({ coords: { latitude: 0, longitude: 0 } });
  const res = await checkCampus({ config: { status: 'unconfigured' }, geolocation: geo, isSecureContext: true });
  assert.equal(res.status, 'unconfigured');
  assert.equal(geo.calls, 0);
  const res2 = await checkCampus({ config: undefined, geolocation: geo, isSecureContext: true });
  assert.equal(res2.status, 'unconfigured');
  assert.equal(geo.calls, 0);
});

test('checkCampus: insecure, unsupported, denied, unavailable, timeout, inside, outside; chỉ trả status', async () => {
  const geoOk = fakeGeo({ coords: { latitude: 0, longitude: 0 } });
  const insecure = await checkCampus({ config: SQUARE, geolocation: geoOk, isSecureContext: false });
  assert.equal(insecure.status, 'insecure');
  assert.equal(geoOk.calls, 0);

  assert.equal((await checkCampus({ config: SQUARE, geolocation: undefined, isSecureContext: true })).status, 'unsupported');
  assert.equal((await checkCampus({ config: SQUARE, geolocation: fakeGeo({ error: { code: 1 } }), isSecureContext: true })).status, 'denied');
  assert.equal((await checkCampus({ config: SQUARE, geolocation: fakeGeo({ error: { code: 2 } }), isSecureContext: true })).status, 'unavailable');
  assert.equal((await checkCampus({ config: SQUARE, geolocation: fakeGeo({ error: { code: 3 } }), isSecureContext: true })).status, 'timeout');

  const inside = await checkCampus({ config: SQUARE, geolocation: geoOk, isSecureContext: true });
  assert.equal(inside.status, 'inside');
  assert.equal(geoOk.calls, 1, 'GPS gọi đúng một lần');
  assert.equal(geoOk.lastOptions.enableHighAccuracy, false);
  assert.equal(geoOk.lastOptions.timeout, 8000);
  assert.deepEqual(Object.keys(inside), ['status']);

  const outside = await checkCampus({ config: SQUARE, geolocation: fakeGeo({ coords: { latitude: 9, longitude: 9 } }), isSecureContext: true });
  assert.equal(outside.status, 'outside');
  assert.deepEqual(Object.keys(outside), ['status']);
});

test('geofenceMessage ánh xạ đúng', () => {
  assert.equal(geofenceMessage('outside'), 'Định vị chỉ hoạt động trong bệnh viện');
  assert.ok(geofenceMessage('denied').includes('Chưa bật quyền vị trí'));
  assert.ok(geofenceMessage('insecure').includes('Chưa bật quyền vị trí'));
  assert.equal(geofenceMessage('unconfigured'), null);
  assert.equal(geofenceMessage('inside'), null);
});

test('PositionProvider: rỗng, manual, bridge thắng manual, lost rơi về manual', () => {
  let t = 1000;
  const p = createPositionProvider({ now: () => t });
  assert.equal(p.current(), null);
  assert.equal(p.isReliable(), false);
  assert.equal(p.status(), 'none');

  p.setManual({ roomId: 'F1_R001', source: 'manual' });
  assert.equal(p.isReliable(), true);
  assert.equal(p.current().isUserChosen, true);
  assert.equal(p.status(), 'manual');

  p.report({ source: 'bridge', roomId: 'F1_R002', confidence: 0.9 });
  assert.equal(p.current().roomId, 'F1_R002');
  assert.equal(p.status(), 'beacon');
  assert.equal(p.current().isUserChosen, false);

  p.markLost('bridge');
  assert.equal(p.current().roomId, 'F1_R001');
  assert.equal(p.current().isUserChosen, true);
});

test('PositionProvider: chỉ beacon rồi lost -> lowConfidence, không reliable', () => {
  const p = createPositionProvider({ now: () => 1000 });
  p.report({ source: 'ble', roomId: 'F1_R003', confidence: 1 });
  assert.equal(p.isReliable(), true);
  p.markLost('ble');
  assert.equal(p.current().lowConfidence, true);
  assert.equal(p.current().roomId, 'F1_R003');
  assert.equal(p.isReliable(), false);
  assert.equal(p.status(), 'beacon-low');
});

test('PositionProvider: quá STALE_MS và confidence thấp -> không reliable', () => {
  let t = 0;
  const p = createPositionProvider({ now: () => t });
  p.report({ source: 'bridge', roomId: 'F1_R004', confidence: 0.9 });
  assert.equal(p.isReliable(), true);
  t = STALE_MS;
  assert.equal(p.isReliable(), true, 'đúng ngưỡng vẫn còn hiệu lực');
  t = STALE_MS + 1;
  assert.equal(p.isReliable(), false);
  assert.equal(p.current().lowConfidence, true);

  const q = createPositionProvider({ now: () => 0 });
  q.report({ source: 'bridge', roomId: 'F1_R004', confidence: 0.3 });
  assert.ok(0.3 < CONFIDENCE_MIN);
  assert.equal(q.isReliable(), false);
  assert.equal(q.current().lowConfidence, true);
});

test('PositionProvider: subscribe nhận cập nhật, unsubscribe ngừng; refresh chỉ báo khi đổi', () => {
  let t = 0;
  const p = createPositionProvider({ now: () => t });
  const seen = [];
  const off = p.subscribe((c) => seen.push(c && c.roomId));
  p.report({ source: 'mock', roomId: 'F1_R005', confidence: 1 });
  assert.deepEqual(seen, ['F1_R005']);
  p.refresh();
  assert.equal(seen.length, 1, 'không đổi -> không báo');
  t = STALE_MS + 5;
  p.refresh();
  assert.equal(seen.length, 2, 'quá hạn -> báo');
  off();
  p.report({ source: 'mock', roomId: 'F1_R006', confidence: 1 });
  assert.equal(seen.length, 2);
});

test('module không động tới storage (Node không có localStorage)', () => {
  assert.equal(typeof globalThis.localStorage, 'undefined');
  assert.equal(typeof globalThis.sessionStorage, 'undefined');
  const p = createPositionProvider();
  p.setManual({ roomId: 'F1_R001', source: 'url' });
  p.clear();
  assert.equal(p.current(), null);
});
