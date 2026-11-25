/**
 * beacon_placement.test.mjs — logic thuần + dịch vụ ghi file (trên bản sao thử trong thư mục tạm).
 * UUID trong test là giá trị giả, không phải dữ liệu thật.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  validatePoint, validateRequestBody, applyPlacement, toPublicList, markerLocalPosition,
  processPlacementRequest, isLoopbackHost, isLoopbackOrigin, floorFrame, MAX_BODY_BYTES,
} from '../src/positioning/beacon_placement.js';
import { createPlacementService } from '../tools/beacon_placement_server.mjs';

const FAKE_UUID = 'FAKE0000-0000-0000-0000-TESTONLY0001';
const ctx = { floors: [{ id: 'F1', height_m: 3.6 }, { id: 'F2', height_m: 3.6 }], frame: floorFrame({ building_width_m: 34.92, building_depth_m: 41.92 }) };
const recs = () => [
  { _comment: 'meta' },
  { id: 'F1_B01', floorId: 'F1', x: 1, z: 2, height_m: 2, protocol: 'iBeacon', uuid: FAKE_UUID, major: 7, minor: 9, status: 'installed' },
  { id: 'F1_B02', floorId: 'F1', x: null, z: null, height_m: 2.5, uuid: FAKE_UUID, major: 7, minor: 10, status: 'planned' },
];
const baseReq = (o = {}) => ({ method: 'POST', pathname: '/api/beacons/placement', remoteAddress: '127.0.0.1',
  host: 'localhost:5173', origin: 'http://localhost:5173', contentType: 'application/json', bodyText: '{}', ...o });
const post = (body, o = {}) => baseReq({ bodyText: JSON.stringify(body), ...o });

describe('validatePoint', () => {
  test('hợp lệ, làm tròn 2 chữ số, mặc định cao 2.5', () => {
    const r = validatePoint({ floorId: 'F1', x: 10.123, z: 5 }, ctx);
    assert.deepEqual(r.value, { floorId: 'F1', x: 10.12, z: 5, height_m: 2.5 });
  });
  test('ngoài khung / tầng lạ / NaN / cao sai', () => {
    assert.equal(validatePoint({ floorId: 'F1', x: -1, z: 1 }, ctx).error, 'out-of-frame');
    assert.equal(validatePoint({ floorId: 'F1', x: 1, z: 41.93 }, ctx).error, 'out-of-frame');
    assert.equal(validatePoint({ floorId: 'F9', x: 1, z: 1 }, ctx).error, 'unknown-floor');
    assert.equal(validatePoint({ floorId: 'F1', x: NaN, z: 1 }, ctx).error, 'invalid-coordinate');
    assert.equal(validatePoint({ floorId: 'F1', x: '1', z: 1 }, ctx).error, 'invalid-coordinate');
    assert.equal(validatePoint({ floorId: 'F1', x: 1, z: 1, height_m: 9 }, ctx).error, 'invalid-height');
    assert.equal(validatePoint({ floorId: 'F1', x: 1, z: 1, height_m: 0 }, ctx).error, 'invalid-height');
  });
});

describe('validateRequestBody / applyPlacement', () => {
  test('từ chối uuid/major/minor và khóa lạ', () => {
    for (const k of ['uuid', 'major', 'minor', 'status']) {
      const r = validateRequestBody({ id: 'F1_B01', floorId: 'F1', x: 1, z: 1, [k]: 'x' }, ctx);
      assert.equal(r.error, 'unexpected-field');
    }
    assert.equal(validateRequestBody({ id: 'F1_B01', remove: true, uuid: 'x' }, ctx).error, 'unexpected-field');
    assert.equal(validateRequestBody({ id: '../x', floorId: 'F1', x: 1, z: 1 }, ctx).error, 'invalid-id');
  });
  test('ghi đè chỉ đổi 4 trường; gỡ đặt x,z null; id lạ trả null; không đột biến đầu vào', () => {
    const src = recs(); const before = JSON.stringify(src);
    const v = validateRequestBody({ id: 'F1_B01', floorId: 'F2', x: 3, z: 4, height_m: 3 }, ctx).value;
    const next = applyPlacement(src, v);
    assert.equal(JSON.stringify(src), before);
    assert.deepEqual(next[1], { ...src[1], floorId: 'F2', x: 3, z: 4, height_m: 3 });
    const rm = applyPlacement(src, { id: 'F1_B01', remove: true });
    assert.equal(rm[1].x, null); assert.equal(rm[1].uuid, FAKE_UUID); assert.equal(rm[1].major, 7);
    assert.equal(applyPlacement(src, { id: 'F1_B99', remove: true }), null);
  });
  test('toPublicList không chứa uuid/major/minor', () => {
    const s = JSON.stringify(toPublicList(recs()));
    assert.ok(!/uuid|major|minor|FAKE0000/i.test(s));
    assert.equal(toPublicList(recs()).length, 2); // bỏ bản ghi chú thích
  });
  test('markerLocalPosition = (x, height_m, z) cục bộ', () => {
    assert.deepEqual(markerLocalPosition({ x: 8.26, z: 7.5, height_m: 2.5 }), { x: 8.26, y: 2.5, z: 7.5 });
  });
});

describe('processPlacementRequest (an ninh + luồng)', () => {
  test('D2: không phải loopback -> 403', () => {
    for (const addr of ['192.168.1.20', '10.0.0.5', undefined, '::ffff:192.168.1.2']) {
      const r = processPlacementRequest(post({ id: 'F1_B01', remove: true }, { remoteAddress: addr }), recs(), ctx);
      assert.equal(r.status, 403); assert.equal(r.nextRecords, undefined);
    }
    assert.equal(processPlacementRequest(baseReq({ method: 'GET', pathname: '/api/beacons/placements', remoteAddress: '192.168.1.20' }), recs(), ctx).status, 403);
  });
  test('D2: Host/Origin lạ -> 403; POST thiếu Origin -> 403', () => {
    assert.equal(processPlacementRequest(post({ id: 'F1_B01', remove: true }, { host: 'evil.example' }), recs(), ctx).status, 403);
    assert.equal(processPlacementRequest(post({ id: 'F1_B01', remove: true }, { origin: 'http://evil.example' }), recs(), ctx).status, 403);
    assert.equal(processPlacementRequest(post({ id: 'F1_B01', remove: true }, { origin: undefined }), recs(), ctx).status, 403);
    assert.equal(processPlacementRequest(post({ id: 'F1_B01', remove: true }, { host: 'localhost.evil.com' }), recs(), ctx).status, 403);
    assert.ok(isLoopbackHost('[::1]:5173') && isLoopbackHost('127.0.0.1:5173') && !isLoopbackHost('192.168.1.5:5173'));
    assert.ok(isLoopbackOrigin('http://localhost:5173') && !isLoopbackOrigin('http://localhost.evil.com') && !isLoopbackOrigin('null'));
  });
  test('Content-Type sai -> 415; body quá lớn -> 413; JSON hỏng -> 400; phương thức sai -> 405', () => {
    assert.equal(processPlacementRequest(post({ id: 'F1_B01', remove: true }, { contentType: 'text/plain' }), recs(), ctx).status, 415);
    assert.equal(processPlacementRequest(baseReq({ bodyText: 'x'.repeat(MAX_BODY_BYTES + 1) }), recs(), ctx).status, 413);
    assert.equal(processPlacementRequest(baseReq({ bodyText: '{oops' }), recs(), ctx).status, 400);
    assert.equal(processPlacementRequest(baseReq({ method: 'GET' }), recs(), ctx).status, 405);
  });
  test('file chưa có -> 404 beacons-file-missing, không ghi', () => {
    const r = processPlacementRequest(post({ id: 'F1_B01', remove: true }), null, ctx);
    assert.equal(r.status, 404); assert.equal(r.body.error, 'beacons-file-missing'); assert.equal(r.nextRecords, undefined);
  });
  test('id lạ -> 404; hợp lệ -> 200 + nextRecords; phản hồi không có uuid', () => {
    assert.equal(processPlacementRequest(post({ id: 'F1_B99', floorId: 'F1', x: 1, z: 1 }), recs(), ctx).status, 404);
    const r = processPlacementRequest(post({ id: 'F1_B02', floorId: 'F1', x: 5, z: 6 }), recs(), ctx);
    assert.equal(r.status, 200);
    assert.ok(!/uuid|major|minor|FAKE0000/i.test(JSON.stringify(r.body)));
    assert.equal(r.nextRecords[2].x, 5);
  });
  test('body có uuid -> 400', () => {
    const r = processPlacementRequest(post({ id: 'F1_B02', floorId: 'F1', x: 5, z: 6, uuid: 'zzz' }), recs(), ctx);
    assert.equal(r.status, 400);
  });
  test('GET placements không chứa uuid', () => {
    const r = processPlacementRequest(baseReq({ method: 'GET', pathname: '/api/beacons/placements', origin: undefined }), recs(), ctx);
    assert.equal(r.status, 200);
    assert.ok(!/uuid|major|minor|FAKE0000/i.test(JSON.stringify(r.body)));
  });
});

describe('createPlacementService (round-trip trên bản sao thử)', () => {
  function setup(withFile = true) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hin-bp-'));
    fs.mkdirSync(path.join(root, 'data'));
    fs.writeFileSync(path.join(root, 'data', 'floors.json'), JSON.stringify(ctx.floors));
    fs.writeFileSync(path.join(root, 'data', 'coordinate_system.json'), JSON.stringify({ building_width_m: 34.92, building_depth_m: 41.92 }));
    if (withFile) fs.writeFileSync(path.join(root, 'data', 'beacons.local.json'), JSON.stringify(recs(), null, 2));
    return root;
  }
  const hashIds = file => JSON.parse(fs.readFileSync(file, 'utf8')).filter(r => r.id)
    .map(r => crypto.createHash('sha256').update(`${r.uuid}|${r.major}|${r.minor}`).digest('hex'));

  test('D3: ghi -> đọc lại đúng; băm uuid/major/minor không đổi; sao lưu một lần', () => {
    const root = setup();
    try {
      const svc = createPlacementService({ root, now: () => new Date('2026-11-09T10:00:00Z') });
      const file = svc.file; const h0 = hashIds(file);
      let r = svc.handle(post({ id: 'F1_B02', floorId: 'F2', x: 12.5, z: 20, height_m: 2.8 }));
      assert.equal(r.status, 200);
      r = svc.handle(post({ id: 'F1_B01', remove: true }));
      assert.equal(r.status, 200);
      const g = svc.handle({ ...baseReq({ method: 'GET', pathname: '/api/beacons/placements', origin: undefined }) });
      const b2 = g.body.placements.find(p => p.id === 'F1_B02');
      assert.deepEqual([b2.floorId, b2.x, b2.z, b2.height_m], ['F2', 12.5, 20, 2.8]);
      assert.equal(g.body.placements.find(p => p.id === 'F1_B01').x, null);
      assert.deepEqual(hashIds(file), h0);
      const baks = fs.readdirSync(path.join(root, 'data')).filter(n => n.includes('.bak-'));
      assert.deepEqual(baks, ['beacons.local.json.bak-2026-11-09']);
      assert.ok(!fs.readdirSync(path.join(root, 'data')).some(n => n.includes('.tmp-')));
      assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8'))[0], { _comment: 'meta' });
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  test('file chưa có -> 404, không tự tạo', () => {
    const root = setup(false);
    try {
      const svc = createPlacementService({ root });
      assert.equal(svc.handle(post({ id: 'F1_B01', remove: true })).status, 404);
      assert.equal(fs.existsSync(svc.file), false);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  test('yêu cầu bị từ chối không làm đổi file', () => {
    const root = setup();
    try {
      const svc = createPlacementService({ root });
      const before = fs.readFileSync(svc.file, 'utf8');
      assert.equal(svc.handle(post({ id: 'F1_B01', floorId: 'F1', x: 3, z: 3 }, { remoteAddress: '192.168.0.9' })).status, 403);
      assert.equal(svc.handle(post({ id: 'F1_B01', floorId: 'F1', x: 999, z: 3 })).status, 400);
      assert.equal(fs.readFileSync(svc.file, 'utf8'), before);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
