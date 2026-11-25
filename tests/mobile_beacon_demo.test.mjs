/**
 * mobile_beacon_demo.test.mjs — Demo di động v2: route công khai đã lọc UUID, chặn đọc file
 * cấu hình beacon thật với client non-loopback, gắn/gỡ phòng, tìm phòng có beacon.
 * UUID trong test là giá trị giả, không phải dữ liệu thật.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  floorFrame, toPublicList, processPlacementRequest,
  validateRoomBody, applyRoomLink, roomsWithBeacons, filterRoomsWithBeacon,
  isProtectedDataPath, shouldBlockDataRequest,
} from '../src/positioning/beacon_placement.js';
import { createPlacementService } from '../tools/beacon_placement_server.mjs';

const FAKE_UUID = 'FAKE0000-0000-0000-0000-TESTONLY0001';
const ctx = {
  floors: [{ id: 'F1', height_m: 3.6 }, { id: 'F2', height_m: 3.6 }],
  frame: floorFrame({ building_width_m: 34.92, building_depth_m: 41.92 }),
  rooms: [
    { id: 'F1_R001', floorId: 'F1', centroid: { x: 3.38, z: 3.12 } },
    { id: 'F2_R010', floorId: 'F2', centroid: { x: 20, z: 10 } },
  ],
};
const recs = () => [
  { _comment: 'meta' },
  { id: 'F1_B01', floorId: 'F1', x: 1, z: 2, height_m: 2, protocol: 'iBeacon', uuid: FAKE_UUID, major: 7, minor: 9, status: 'installed' },
  { id: 'F1_B02', floorId: 'F1', x: null, z: null, height_m: 2.5, uuid: FAKE_UUID, major: 7, minor: 10, status: 'planned' },
];
const roomReq = (body, o = {}) => ({
  method: 'POST', pathname: '/api/beacons/room', remoteAddress: '127.0.0.1', host: 'localhost:5173',
  origin: 'http://localhost:5173', contentType: 'application/json', bodyText: JSON.stringify(body), ...o,
});
const pubReq = (o = {}) => ({
  method: 'GET', pathname: '/api/beacons/public', remoteAddress: '192.168.1.50',
  host: '192.168.1.10:5173', origin: undefined, contentType: undefined, ...o,
});
const LEAK = /uuid|major|minor|FAKE0000/i;

describe('route công khai /api/beacons/public (lọc UUID)', () => {
  test('client LAN (non-loopback) -> 200, không uuid/major/minor; có roomId', () => {
    const rs = recs(); rs[1].roomId = 'F1_R001';
    const r = processPlacementRequest(pubReq(), rs, ctx);
    assert.equal(r.status, 200);
    assert.ok(!LEAK.test(JSON.stringify(r.body)));
    assert.equal(r.nextRecords, undefined);
    const b1 = r.body.beacons.find(b => b.id === 'F1_B01');
    assert.deepEqual(Object.keys(b1).sort(), ['floorId', 'height_m', 'id', 'roomId', 'status', 'x', 'z']);
    assert.equal(b1.roomId, 'F1_R001');
    assert.equal(r.body.beacons.find(b => b.id === 'F1_B02').roomId, null);
  });
  test('roomId sai định dạng bị bỏ; chỉ GET; file thiếu -> 404', () => {
    const rs = recs(); rs[1].roomId = '../../etc';
    assert.equal(processPlacementRequest(pubReq(), rs, ctx).body.beacons[0].roomId, null);
    assert.equal(processPlacementRequest(pubReq({ method: 'POST' }), recs(), ctx).status, 405);
    assert.equal(processPlacementRequest(pubReq(), null, ctx).status, 404);
  });
  test('route ghi / route đầy đủ vẫn từ chối client non-loopback', () => {
    assert.equal(processPlacementRequest(roomReq({ id: 'F1_B01', roomId: 'F1_R001' }, { remoteAddress: '192.168.1.50' }), recs(), ctx).status, 403);
    assert.equal(processPlacementRequest(pubReq({ pathname: '/api/beacons/placements' }), recs(), ctx).status, 403);
  });
});

describe('chặn đọc file cấu hình beacon thật với client non-loopback', () => {
  const paths = [
    '/data/beacons.local.json', '/data/beacon-map.local.json', '/data/beacons.local.json.bak-2026-11-09',
    '/data/beacon-map.local.json.bak-2026-11-09', '/data/beacons.local.json?import', '/data/beacons.local.json?t=123',
    '/data//beacons.local.json', '/data/%62eacons.local.json', '/data/beacons%2Elocal.json', '/data/%2562eacons.local.json',
    '/DATA/Beacons.Local.JSON', '/data\\beacons.local.json', '/@fs/D:/x/data/beacons.local.json',
    '/data/beacons.local.json.tmp-1', '/data/%E0%A4%A',
  ];
  test('mọi biến thể đường dẫn bị chặn với client LAN', () => {
    for (const url of paths) {
      for (const remoteAddress of ['192.168.1.50', '::ffff:192.168.1.50', '10.0.0.5', undefined]) {
        assert.equal(shouldBlockDataRequest({ url, remoteAddress }), true, `${url} @ ${remoteAddress}`);
      }
    }
  });
  test('loopback vẫn đọc được (beacon-admin trên laptop); file khác không bị chặn', () => {
    for (const a of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
      assert.equal(shouldBlockDataRequest({ url: '/data/beacons.local.json', remoteAddress: a }), false);
    }
    for (const url of ['/data/rooms.json', '/data/beacon-map.json', '/data/beacons.json', '/api/beacons/public', '/', '/src/main.js']) {
      assert.equal(isProtectedDataPath(url), false, url);
      assert.equal(shouldBlockDataRequest({ url, remoteAddress: '192.168.1.50' }), false, url);
    }
  });
});

describe('gắn / gỡ phòng cho beacon (roomId)', () => {
  test('hợp lệ: phòng tồn tại; beacon chưa có x,z -> lấy tầng + tâm phòng; không đụng định danh', () => {
    const v = validateRoomBody({ id: 'F1_B02', roomId: 'F1_R001' }, ctx);
    assert.equal(v.ok, true);
    const next = applyRoomLink(recs(), v.value);
    assert.deepEqual([next[2].roomId, next[2].floorId, next[2].x, next[2].z], ['F1_R001', 'F1', 3.38, 3.12]);
    assert.equal(next[2].uuid, FAKE_UUID); assert.equal(next[2].major, 7);
  });
  test('đã có x,z cùng tầng -> giữ x,z; khác tầng -> chuyển tầng + tâm phòng', () => {
    const same = applyRoomLink(recs(), validateRoomBody({ id: 'F1_B01', roomId: 'F1_R001' }, ctx).value);
    assert.deepEqual([same[1].x, same[1].z, same[1].floorId, same[1].roomId], [1, 2, 'F1', 'F1_R001']);
    const diff = applyRoomLink(recs(), validateRoomBody({ id: 'F1_B01', roomId: 'F2_R010' }, ctx).value);
    assert.deepEqual([diff[1].x, diff[1].z, diff[1].floorId, diff[1].roomId], [20, 10, 'F2', 'F2_R010']);
  });
  test('từ chối: phòng không tồn tại, id sai, khóa lạ, body không hợp lệ', () => {
    assert.equal(validateRoomBody({ id: 'F1_B01', roomId: 'F9_R999' }, ctx).error, 'unknown-room');
    assert.equal(validateRoomBody({ id: 'F1_B01', roomId: '../x' }, ctx).error, 'invalid-room-id');
    assert.equal(validateRoomBody({ id: 'x', roomId: 'F1_R001' }, ctx).error, 'invalid-id');
    assert.equal(validateRoomBody({ id: 'F1_B01', roomId: 'F1_R001', uuid: 'z' }, ctx).error, 'unexpected-field');
    assert.equal(validateRoomBody({ id: 'F1_B01' }, ctx).error, 'invalid-room-id');
    assert.equal(validateRoomBody(null, ctx).error, 'invalid-body');
    assert.equal(validateRoomBody({ id: 'F1_B01', removeRoom: false }, ctx).error, 'invalid-body');
    assert.equal(validateRoomBody({ id: 'F1_B01', removeRoom: true, roomId: 'F1_R001' }, ctx).error, 'unexpected-field');
  });
  test('beacon lạ -> null; một phòng nhiều beacon; gỡ phòng đặt roomId null, giữ x,z', () => {
    assert.equal(applyRoomLink(recs(), { id: 'F1_B99', removeRoom: false, room: ctx.rooms[0] }), null);
    let rs = applyRoomLink(recs(), validateRoomBody({ id: 'F1_B01', roomId: 'F1_R001' }, ctx).value);
    rs = applyRoomLink(rs, validateRoomBody({ id: 'F1_B02', roomId: 'F1_R001' }, ctx).value);
    assert.equal(roomsWithBeacons(toPublicList(rs)).get('F1_R001').length, 2);
    const rm = applyRoomLink(rs, { id: 'F1_B01', removeRoom: true });
    assert.equal(rm[1].roomId, null); assert.equal(rm[1].x, 1); assert.equal(rm[1].uuid, FAKE_UUID);
  });
  test('qua processPlacementRequest: 200 không lộ uuid; thiếu Origin 403; phòng lạ 400; beacon lạ 404; sai Content-Type 415', () => {
    const ok = processPlacementRequest(roomReq({ id: 'F1_B02', roomId: 'F1_R001' }), recs(), ctx);
    assert.equal(ok.status, 200); assert.equal(ok.body.placement.roomId, 'F1_R001');
    assert.ok(!LEAK.test(JSON.stringify(ok.body)));
    assert.equal(processPlacementRequest(roomReq({ id: 'F1_B02', roomId: 'F1_R001' }, { origin: undefined }), recs(), ctx).status, 403);
    assert.equal(processPlacementRequest(roomReq({ id: 'F1_B02', roomId: 'F5_R005' }), recs(), ctx).status, 400);
    assert.equal(processPlacementRequest(roomReq({ id: 'F1_B77', roomId: 'F1_R001' }), recs(), ctx).status, 404);
    assert.equal(processPlacementRequest(roomReq({ id: 'F1_B02', roomId: 'F1_R001' }, { contentType: 'text/plain' }), recs(), ctx).status, 415);
  });
});

describe('tìm phòng có beacon (điện thoại)', () => {
  const rooms = [{ id: 'F1_R001', name: 'A' }, { id: 'F1_R002', name: 'B' }, { id: 'F2_R010', name: 'C' }];
  test('chỉ phòng có beacon đã gắn; beacon chưa gắn phòng bị ẩn', () => {
    const list = [{ id: 'F1_B01', roomId: 'F1_R001' }, { id: 'F1_B02', roomId: null }, { id: 'F1_B03' },
      { id: 'F1_B04', roomId: '' }, null, { roomId: 'F2_R010' }];
    const m = roomsWithBeacons(list);
    assert.deepEqual([...m.keys()], ['F1_R001']);
    assert.deepEqual(filterRoomsWithBeacon(rooms, m).map(r => r.id), ['F1_R001']);
    assert.deepEqual(filterRoomsWithBeacon(rooms, roomsWithBeacons([])).map(r => r.id), []);
    assert.equal(roomsWithBeacons(undefined).size, 0);
  });
});

describe('createPlacementService: route phòng + công khai (bản sao thử)', () => {
  test('gắn phòng ghi file, định danh không đổi; route công khai không uuid', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hin-bp2-'));
    try {
      fs.mkdirSync(path.join(root, 'data'));
      fs.writeFileSync(path.join(root, 'data', 'floors.json'), JSON.stringify(ctx.floors));
      fs.writeFileSync(path.join(root, 'data', 'coordinate_system.json'), JSON.stringify({ building_width_m: 34.92, building_depth_m: 41.92 }));
      fs.writeFileSync(path.join(root, 'data', 'rooms.json'), JSON.stringify(ctx.rooms));
      fs.writeFileSync(path.join(root, 'data', 'beacons.local.json'), JSON.stringify(recs(), null, 2));
      const svc = createPlacementService({ root, now: () => new Date('2026-11-09T10:00:00Z') });
      const ids = f => JSON.parse(fs.readFileSync(f, 'utf8')).filter(r => r.id).map(r => `${r.uuid}|${r.major}|${r.minor}`);
      const h0 = ids(svc.file);
      assert.equal(svc.handle(roomReq({ id: 'F1_B02', roomId: 'F2_R010' })).status, 200);
      assert.equal(svc.handle(roomReq({ id: 'F1_B02', roomId: 'F8_R888' })).status, 400);
      const pub = svc.handle(pubReq());
      assert.equal(pub.status, 200);
      assert.ok(!LEAK.test(JSON.stringify(pub.body)));
      assert.equal(pub.body.beacons.find(b => b.id === 'F1_B02').roomId, 'F2_R010');
      assert.deepEqual(ids(svc.file), h0);
      assert.equal(svc.handle(roomReq({ id: 'F1_B02', removeRoom: true })).status, 200);
      assert.equal(svc.handle(pubReq()).body.beacons.find(b => b.id === 'F1_B02').roomId, null);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
