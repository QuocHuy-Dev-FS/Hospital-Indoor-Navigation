/**
 * bench.test.mjs — Unit tests cho bench/packet-parser.js và bench/room-resolver.js
 * Dữ liệu tổng hợp (synthetic) — không dùng beacon thật.
 * Chạy: node --test tests/bench.test.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  bytesToHex,
  bytesToUUID,
  parseManufacturerData,
  buildIBeaconManufacturerData,
  iBeaconKey,
} from '../bench/packet-parser.js';

import {
  RoomResolver,
  DEFAULT_PARAMS,
} from '../bench/room-resolver.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SAMPLE_UUID = '00000001-0000-0000-0000-000000000000';

/** Tạo Map<companyId, DataView> giả cho iBeacon (dữ liệu tổng hợp). */
function makeIBeaconMap(uuid = SAMPLE_UUID, major = 1, minor = 1, txPower = -59) {
  return buildIBeaconManufacturerData(uuid, major, minor, txPower);
}

/** Bảng ánh xạ mẫu (placeholder, không UUID thật). */
const SAMPLE_MAP = [
  { beaconKey: `${SAMPLE_UUID}-1-1`, roomId: 'F1_R101', roomName: 'Phòng A' },
  { beaconKey: `${SAMPLE_UUID}-1-2`, roomId: 'F1_R102', roomName: 'Phòng B' },
  { beaconKey: `${SAMPLE_UUID}-1-3`, roomId: 'F1_R103', roomName: 'Phòng C' },
];

/** Thêm N mẫu cùng RSSI vào resolver. */
function feedSamples(resolver, beaconKey, rssi, count, baseTime = 1000) {
  for (let i = 0; i < count; i++) {
    resolver.addSample(beaconKey, rssi, baseTime + i * 1000);
  }
}

// ─── packet-parser: bytesToHex ────────────────────────────────────────────────
describe('bytesToHex', () => {
  test('mảng rỗng → chuỗi rỗng', () => {
    assert.equal(bytesToHex([]), '');
  });

  test('mảng 1 byte', () => {
    assert.equal(bytesToHex([0x4C]), '4c');
  });

  test('mảng nhiều byte', () => {
    assert.equal(bytesToHex([0x02, 0x15, 0xFF]), '02 15 ff');
  });
});

// ─── packet-parser: bytesToUUID ───────────────────────────────────────────────
describe('bytesToUUID', () => {
  test('16 byte zero → UUID zero', () => {
    const bytes = new Uint8Array(16).fill(0);
    assert.equal(bytesToUUID(bytes), '00000000-0000-0000-0000-000000000000');
  });

  test('byte đầu = 0xDE → UUID bắt đầu bằng de', () => {
    const bytes = new Uint8Array(16).fill(0);
    bytes[0] = 0xDE; bytes[1] = 0xAD; bytes[2] = 0xBE; bytes[3] = 0xEF;
    assert.ok(bytesToUUID(bytes).startsWith('deadbeef-'));
  });
});

// ─── packet-parser: parseManufacturerData iBeacon ─────────────────────────────
describe('parseManufacturerData – iBeacon (synthetic)', () => {
  test('nhận dạng đúng iBeacon', () => {
    const map = makeIBeaconMap(SAMPLE_UUID, 1, 2, -59);
    const result = parseManufacturerData(map);
    assert.equal(result.type, 'iBeacon');
  });

  test('UUID trả về đúng (lowercase, dạng 8-4-4-4-12)', () => {
    const map = makeIBeaconMap(SAMPLE_UUID, 1, 1, -59);
    const result = parseManufacturerData(map);
    assert.equal(result.uuid, SAMPLE_UUID);
  });

  test('major và minor đúng', () => {
    const map = makeIBeaconMap(SAMPLE_UUID, 7, 42, -59);
    const result = parseManufacturerData(map);
    assert.equal(result.major, 7);
    assert.equal(result.minor, 42);
  });

  test('txPower âm (-59) đúng', () => {
    const map = makeIBeaconMap(SAMPLE_UUID, 1, 1, -59);
    const result = parseManufacturerData(map);
    assert.equal(result.txPower, -59);
  });

  test('txPower 0 đúng', () => {
    const map = makeIBeaconMap(SAMPLE_UUID, 1, 1, 0);
    const result = parseManufacturerData(map);
    assert.equal(result.txPower, 0);
  });

  test('rawHex không rỗng', () => {
    const map = makeIBeaconMap(SAMPLE_UUID, 1, 1, -59);
    const result = parseManufacturerData(map);
    assert.ok(result.rawHex.length > 0);
  });
});

// ─── packet-parser: parseManufacturerData – không phải iBeacon ───────────────
describe('parseManufacturerData – non-iBeacon (synthetic)', () => {
  test('không có manufacturerData → no-manufacturer-data', () => {
    assert.equal(parseManufacturerData(null).type, 'no-manufacturer-data');
    assert.equal(parseManufacturerData(undefined).type, 'no-manufacturer-data');
    assert.equal(parseManufacturerData(new Map()).type, 'no-manufacturer-data');
  });

  test('company ID khác Apple → unknown', () => {
    const buf = new Uint8Array(4).fill(0xAA);
    const dv = new DataView(buf.buffer);
    const map = new Map([[0x0059, dv]]); // Nordic company ID
    const result = parseManufacturerData(map);
    assert.equal(result.type, 'unknown');
    assert.equal(result.companyId, 0x0059);
  });

  test('Apple nhưng payload ngắn → unknown', () => {
    const buf = new Uint8Array(5).fill(0x02);
    const dv = new DataView(buf.buffer);
    const map = new Map([[0x004C, dv]]);
    const result = parseManufacturerData(map);
    assert.equal(result.type, 'unknown');
  });

  test('serviceData Eddystone → eddystone', () => {
    const sd = new Uint8Array([0x10, 0x00, 0x01]); // Eddystone-URL
    const result = parseManufacturerData(new Map(), sd);
    assert.equal(result.type, 'eddystone');
    assert.ok(result.rawHex.length > 0);
  });
});

// ─── packet-parser: iBeaconKey ────────────────────────────────────────────────
describe('iBeaconKey', () => {
  test('dạng uuid-lower-major-minor', () => {
    const map = makeIBeaconMap(SAMPLE_UUID, 3, 7, -59);
    const parsed = parseManufacturerData(map);
    const key = iBeaconKey(parsed);
    assert.equal(key, `${SAMPLE_UUID}-3-7`);
  });

  test('ném lỗi nếu không phải iBeacon', () => {
    assert.throws(() => iBeaconKey({ type: 'unknown' }));
  });
});

// ─── room-resolver: kết luận đúng phòng ──────────────────────────────────────
describe('RoomResolver – kết luận đúng phòng (synthetic)', () => {
  test('đủ mẫu liên tiếp → near-room đúng phòng', () => {
    // minConsecutive=3 đòi hỏi gọi resolve() 3 lần liên tiếp cùng kết quả
    const r = new RoomResolver(SAMPLE_MAP, { minConsecutive: 3 });
    const key = SAMPLE_MAP[0].beaconKey;
    const t = 10_000;
    feedSamples(r, key, -60, 5, t);
    r.resolve(t + 5000);
    r.resolve(t + 5001);
    const result = r.resolve(t + 5002);
    assert.equal(result.status, 'near-room');
    assert.equal(result.roomId, 'F1_R101');
  });

  test('beacon mạnh nhất thắng khi đủ biên hysteresis', () => {
    const r = new RoomResolver(SAMPLE_MAP, { minConsecutive: 3, hysteresisMargin: 5 });
    const keyA = SAMPLE_MAP[0].beaconKey;
    const keyB = SAMPLE_MAP[1].beaconKey;
    const t = 10_000;
    feedSamples(r, keyA, -60, 5, t);
    feedSamples(r, keyB, -75, 5, t);
    r.resolve(t + 5000);
    r.resolve(t + 5001);
    const result = r.resolve(t + 5002);
    assert.equal(result.roomId, 'F1_R101');
  });
});

// ─── room-resolver: chồng lấn ─────────────────────────────────────────────────
describe('RoomResolver – chồng lấn (synthetic)', () => {
  test('2 beacon gần nhau → uncertain', () => {
    const r = new RoomResolver(SAMPLE_MAP, { hysteresisMargin: 5, minConsecutive: 1 });
    const keyA = SAMPLE_MAP[0].beaconKey;
    const keyB = SAMPLE_MAP[1].beaconKey;
    const t = 10_000;
    feedSamples(r, keyA, -66, 3, t);
    feedSamples(r, keyB, -68, 3, t);
    const result = r.resolve(t + 3000);
    assert.equal(result.status, 'uncertain');
    assert.ok(result.reason.includes('chồng lấn'));
  });
});

// ─── room-resolver: mất tín hiệu ──────────────────────────────────────────────
describe('RoomResolver – mất tín hiệu (synthetic)', () => {
  test('không có mẫu nào → uncertain "chưa có mẫu"', () => {
    const r = new RoomResolver(SAMPLE_MAP);
    const result = r.resolve(1000);
    assert.equal(result.status, 'uncertain');
    assert.ok(result.reason.includes('chưa có mẫu'));
  });

  test('mẫu hết TTL → lost với mốc cuối cùng', () => {
    const r = new RoomResolver(SAMPLE_MAP, { sampleTTL_ms: 2_000, minConsecutive: 1, hysteresisMargin: 5 });
    const keyA = SAMPLE_MAP[0].beaconKey;
    // Thêm mẫu lúc t=1000, sau đó resolve lúc t=1000 để xác nhận rồi đọc lại lúc t=4000 (hết TTL)
    feedSamples(r, keyA, -60, 2, 1000);
    r.resolve(2000); // xác nhận confident
    const result = r.resolve(5000); // hết TTL
    assert.equal(result.status, 'lost');
    assert.ok(result.reason.includes('mất tín hiệu'));
  });
});

// ─── room-resolver: nhiễu và hysteresis ───────────────────────────────────────
describe('RoomResolver – nhiễu và hysteresis (synthetic)', () => {
  test('RSSI dưới ngưỡng → uncertain "quá yếu"', () => {
    const r = new RoomResolver(SAMPLE_MAP, { rssiThreshold: -80, minConsecutive: 1 });
    const key = SAMPLE_MAP[0].beaconKey;
    const t = 10_000;
    feedSamples(r, key, -90, 3, t);
    const result = r.resolve(t + 3000);
    assert.equal(result.status, 'uncertain');
    assert.ok(result.reason.includes('quá yếu'));
  });

  test('chưa đủ minConsecutive → uncertain "chờ xác nhận"', () => {
    const r = new RoomResolver(SAMPLE_MAP, { minConsecutive: 5, hysteresisMargin: 3 });
    const key = SAMPLE_MAP[0].beaconKey;
    const t = 10_000;
    feedSamples(r, key, -60, 2, t);
    const result = r.resolve(t + 2000);
    assert.equal(result.status, 'uncertain');
    assert.ok(result.reason.includes('xác nhận'));
  });

  test('reset → trạng thái sạch', () => {
    const r = new RoomResolver(SAMPLE_MAP, { minConsecutive: 1 });
    feedSamples(r, SAMPLE_MAP[0].beaconKey, -60, 3, 10_000);
    r.resolve(13_000);
    r.reset();
    const result = r.resolve(14_000);
    assert.equal(result.status, 'uncertain');
    assert.ok(result.reason.includes('chưa có mẫu'));
  });
});

// ─── room-resolver: stats ─────────────────────────────────────────────────────
describe('RoomResolver – stats (synthetic)', () => {
  test('thống kê đúng với dữ liệu đơn giản', () => {
    const r = new RoomResolver(SAMPLE_MAP);
    const key = SAMPLE_MAP[0].beaconKey;
    const t = 10_000;
    for (const rssi of [-60, -62, -64]) {
      r.addSample(key, rssi, t);
    }
    const s = r.stats(key, t + 100);
    assert.ok(s !== null);
    assert.equal(s.count, 3);
    assert.ok(s.mean >= -64 && s.mean <= -60);
    assert.equal(s.min, -64);
    assert.equal(s.max, -60);
  });

  test('beacon chưa có mẫu → null', () => {
    const r = new RoomResolver(SAMPLE_MAP);
    assert.equal(r.stats(SAMPLE_MAP[2].beaconKey, 1000), null);
  });
});
