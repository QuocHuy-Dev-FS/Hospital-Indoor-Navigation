/**
 * tests/streetview.test.mjs — Kiểm tra tính hợp lệ của data street view
 * Chạy: node --test tests/streetview.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root  = path.join(__dir, '..');

function loadJSON(rel) {
  return JSON.parse(readFileSync(path.join(root, rel), 'utf8'));
}

const photoNodes   = loadJSON('data/photo-nodes.json');
const schematic    = loadJSON('data/layout-schematic.json');
const routes       = loadJSON('data/routes.json');

// ─── photo-nodes.json ────────────────────────────────────────────────────────

describe('photo-nodes.json', () => {
  test('có đúng 15 node', () => {
    assert.equal(photoNodes.length, 15);
  });

  test('mỗi node có id, floorId, seq, file, privacy', () => {
    for (const n of photoNodes) {
      assert.ok(n.id,      `${n.id ?? '?'}: thiếu id`);
      assert.ok(n.floorId, `${n.id}: thiếu floorId`);
      assert.ok(n.seq > 0, `${n.id}: seq phải > 0`);
      assert.ok(n.file,    `${n.id}: thiếu file`);
      assert.ok(n.privacy, `${n.id}: thiếu privacy`);
    }
  });

  test('mỗi node có trường verified (boolean)', () => {
    for (const n of photoNodes) {
      assert.ok(typeof n.verified === 'boolean', `${n.id}: verified phải là boolean`);
    }
  });

  test('PH_001–005 và PH_010–012 phải verified=true', () => {
    const shouldBeTrue = ['PH_001','PH_002','PH_003','PH_004','PH_005','PH_010','PH_011','PH_012'];
    for (const id of shouldBeTrue) {
      const n = photoNodes.find(n => n.id === id);
      assert.ok(n, `Không tìm thấy ${id}`);
      assert.equal(n.verified, true, `${id}: phải verified=true`);
    }
  });

  test('PH_006–009 và PH_013–015 phải verified=false', () => {
    const shouldBeFalse = ['PH_006','PH_007','PH_008','PH_009','PH_013','PH_014','PH_015'];
    for (const id of shouldBeFalse) {
      const n = photoNodes.find(n => n.id === id);
      assert.ok(n, `Không tìm thấy ${id}`);
      assert.equal(n.verified, false, `${id}: phải verified=false`);
    }
  });

  test('node có privacy.faces=true hoặc screensOrDocs=true phải bị filter (không hiện ảnh)', () => {
    const privacyNodes = photoNodes.filter(n => n.privacy.faces || n.privacy.screensOrDocs);
    assert.ok(privacyNodes.length > 0, 'Phải có ít nhất 1 node có privacy');
    // PH_001 có faces=true
    const ph1 = photoNodes.find(n => n.id === 'PH_001');
    assert.equal(ph1.privacy.faces, true);
    // PH_008 có screensOrDocs=true
    const ph8 = photoNodes.find(n => n.id === 'PH_008');
    assert.equal(ph8.privacy.screensOrDocs, true);
  });

  test('chuỗi prev/next liên tục từ PH_001 đến PH_015', () => {
    const nodeMap = Object.fromEntries(photoNodes.map(n => [n.id, n]));
    let cur = nodeMap['PH_001'];
    assert.equal(cur.prev, null, 'PH_001 phải không có prev');
    let count = 1;
    while (cur.next) {
      const nxt = nodeMap[cur.next];
      assert.ok(nxt, `Không tìm thấy next: ${cur.next}`);
      assert.equal(nxt.prev, cur.id, `${nxt.id}.prev phải trỏ về ${cur.id}`);
      cur = nxt;
      count++;
    }
    assert.equal(count, 15, 'Phải có đúng 15 node trong chuỗi');
    assert.equal(cur.id, 'PH_015', 'Node cuối phải là PH_015');
  });

  test('seq tăng dần từ 1 đến 15', () => {
    const seqs = photoNodes.map(n => n.seq).sort((a, b) => a - b);
    for (let i = 0; i < 15; i++) assert.equal(seqs[i], i + 1);
  });
});

// ─── layout-schematic.json ───────────────────────────────────────────────────

describe('layout-schematic.json', () => {
  test('có coordSys với building_width_m và building_depth_m', () => {
    assert.ok(schematic.coordSys, 'Thiếu coordSys');
    assert.ok(schematic.coordSys.building_width_m > 0, 'building_width_m phải > 0');
    assert.ok(schematic.coordSys.building_depth_m > 0, 'building_depth_m phải > 0');
  });

  test('có đúng 15 nodes với id, floorId, x, z', () => {
    assert.equal(schematic.nodes.length, 15);
    for (const n of schematic.nodes) {
      assert.ok(n.id,           `Thiếu id trong schematic node`);
      assert.ok(n.floorId,      `${n.id}: thiếu floorId`);
      assert.ok(typeof n.x === 'number', `${n.id}: x phải là number`);
      assert.ok(typeof n.z === 'number', `${n.id}: z phải là number`);
    }
  });

  test('mỗi node trong photo-nodes.json có entry trong schematic', () => {
    const ids = new Set(schematic.nodes.map(n => n.id));
    for (const n of photoNodes) {
      assert.ok(ids.has(n.id), `${n.id} thiếu trong layout-schematic`);
    }
  });

  test('tọa độ nằm trong bounds coordSys', () => {
    const { building_width_m: w, building_depth_m: d } = schematic.coordSys;
    for (const n of schematic.nodes) {
      assert.ok(n.x >= 0 && n.x <= w, `${n.id}: x=${n.x} ngoài bounds [0,${w}]`);
      assert.ok(n.z >= 0 && n.z <= d, `${n.id}: z=${n.z} ngoài bounds [0,${d}]`);
    }
  });
});

// ─── routes.json ─────────────────────────────────────────────────────────────

describe('routes.json', () => {
  test('có trường segments là mảng', () => {
    assert.ok(Array.isArray(routes.segments), 'segments phải là mảng');
    assert.ok(routes.segments.length > 0, 'phải có ít nhất 1 segment');
  });

  test('mỗi segment có id, floorId, nodeIds, verified', () => {
    for (const s of routes.segments) {
      assert.ok(s.id,                          `Segment thiếu id`);
      assert.ok(s.floorId,                     `${s.id}: thiếu floorId`);
      assert.ok(Array.isArray(s.nodeIds),       `${s.id}: nodeIds phải là mảng`);
      assert.ok(s.nodeIds.length > 0,           `${s.id}: nodeIds rỗng`);
      assert.ok(typeof s.verified === 'boolean',`${s.id}: verified phải là boolean`);
    }
  });

  test('tất cả nodeId trong segments phải là verified=true trong photo-nodes', () => {
    const nodeMap = Object.fromEntries(photoNodes.map(n => [n.id, n]));
    for (const seg of routes.segments) {
      if (!seg.verified) continue;
      for (const nid of seg.nodeIds) {
        const n = nodeMap[nid];
        assert.ok(n, `${nid} không có trong photo-nodes`);
        assert.equal(n.verified, true, `${nid} trong segment verified nhưng node.verified=false`);
      }
    }
  });

  test('seg_F1_lobby chứa PH_001–PH_005', () => {
    const seg = routes.segments.find(s => s.id === 'seg_F1_lobby');
    assert.ok(seg, 'Thiếu segment seg_F1_lobby');
    assert.deepEqual(seg.nodeIds, ['PH_001','PH_002','PH_003','PH_004','PH_005']);
  });

  test('seg_F2_corridor chứa PH_010–PH_012', () => {
    const seg = routes.segments.find(s => s.id === 'seg_F2_corridor');
    assert.ok(seg, 'Thiếu segment seg_F2_corridor');
    assert.deepEqual(seg.nodeIds, ['PH_010','PH_011','PH_012']);
  });

  test('unverifiedNodes liệt kê đủ các node chưa xác nhận', () => {
    const expected = ['PH_006','PH_007','PH_008','PH_009','PH_013','PH_014','PH_015'];
    assert.deepEqual(routes.unverifiedNodes.sort(), expected.sort());
  });
});
