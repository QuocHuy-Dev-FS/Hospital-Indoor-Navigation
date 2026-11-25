/**
 * tests/nav.test.mjs — Unit tests cho A*, sinh chỉ dẫn, chuẩn hóa tiếng Việt
 * Chạy: node --test tests/
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeViet, RoomSearch } from '../src/search/search.js';
import { buildGraph, astar } from '../src/nav/astar.js';
import { generateInstructions } from '../src/nav/instructions.js';

// ─── Test: normalizeViet ──────────────────────────────────────────────────────
describe('normalizeViet', () => {
  test('loại bỏ dấu tiếng Việt', () => {
    assert.equal(normalizeViet('Phòng Trưởng ban'), 'phong truong ban');
    assert.equal(normalizeViet('Phòng Hành chính'), 'phong hanh chinh');
    assert.equal(normalizeViet('Phòng kỹ thuật'), 'phong ky thuat');
    assert.equal(normalizeViet('WC Nữ'), 'wc nu');
    assert.equal(normalizeViet('Điều hành'), 'dieu hanh');
    assert.equal(normalizeViet('Kho'), 'kho');
    assert.equal(normalizeViet('Trung Tâm dữ liệu'), 'trung tam du lieu');
  });

  test('chuyển đ/Đ thành d/D', () => {
    assert.equal(normalizeViet('đường đi'), 'duong di');
    assert.equal(normalizeViet('Điều dưỡng'), 'dieu duong');
  });

  test('chuỗi rỗng', () => {
    assert.equal(normalizeViet(''), '');
    assert.equal(normalizeViet(null), '');
    assert.equal(normalizeViet(undefined), '');
  });
});

// ─── Test: RoomSearch ─────────────────────────────────────────────────────────
describe('RoomSearch', () => {
  const sampleRooms = [
    { id: 'F1_R005', floorId: 'F1', name: 'Phòng Trưởng ban', nameAscii: 'phong truong ban', type: 'office', accessible: true, aliases: [], unlabeled: false, doorNodeId: 'F1_D005' },
    { id: 'F1_R006', floorId: 'F1', name: 'Phòng kỹ thuật',   nameAscii: 'phong ky thuat',   type: 'office', accessible: true, aliases: [], unlabeled: false, doorNodeId: 'F1_D006' },
    { id: 'F1_R007', floorId: 'F1', name: 'WC Nam',           nameAscii: 'wc nam',            type: 'wc',    accessible: false, aliases: [], unlabeled: false, doorNodeId: 'F1_D007' },
    { id: 'F1_R008', floorId: 'F1', name: 'WC Nữ',            nameAscii: 'wc nu',             type: 'wc',    accessible: false, aliases: [], unlabeled: false, doorNodeId: 'F1_D008' },
    { id: 'F1_R009', floorId: 'F1', name: 'Phòng Hành chính', nameAscii: 'phong hanh chinh',  type: 'office', accessible: true, aliases: [], unlabeled: false, doorNodeId: 'F1_D009' },
    { id: 'F1_R010', floorId: 'F1', name: 'Phòng Điều hành',  nameAscii: 'phong dieu hanh',   type: 'office', accessible: true, aliases: [], unlabeled: false, doorNodeId: 'F1_D010' },
    { id: 'F1_R027', floorId: 'F1', name: 'Trung Tâm dữ liệu',nameAscii: 'trung tam du lieu', type: 'office', accessible: true, aliases: [], unlabeled: false, doorNodeId: 'F1_D027' },
    { id: 'F1_R028', floorId: 'F1', name: 'Kho',               nameAscii: 'kho',               type: 'storage', accessible: true, aliases: [], unlabeled: false, doorNodeId: 'F1_D028' },
  ];
  const searcher = new RoomSearch(sampleRooms);

  test('tìm "tuong ban" ra Phòng Trưởng ban', () => {
    const results = searcher.search('tuong ban');
    assert.ok(results.length > 0, 'Phải có kết quả');
    assert.equal(results[0].id, 'F1_R005');
  });

  test('tìm "wc" ra WC', () => {
    const results = searcher.search('wc');
    assert.ok(results.length >= 2, 'Phải tìm ra ít nhất 2 WC');
    const types = results.map(r => r.type);
    assert.ok(types.every(t => t === 'wc'));
  });

  test('tìm "hanh chinh"', () => {
    const results = searcher.search('hanh chinh');
    assert.ok(results.some(r => r.id === 'F1_R009'), 'Phải tìm ra Hành chính');
  });

  test('tìm "kho"', () => {
    const results = searcher.search('kho');
    assert.ok(results.some(r => r.id === 'F1_R028'), 'Phải tìm ra Kho');
  });

  test('tìm "trung tam du lieu"', () => {
    const results = searcher.search('trung tam du lieu');
    assert.ok(results.some(r => r.id === 'F1_R027'), 'Phải tìm ra Trung Tâm dữ liệu');
  });

  test('tìm chuỗi rỗng trả về []', () => {
    assert.deepEqual(searcher.search(''), []);
  });
});

// ─── Test: A* cùng tầng ───────────────────────────────────────────────────────
describe('A* - cùng tầng', () => {
  // Graph đơn giản: A - B - C - D
  // A(0,0,0) -- 1m -- B(1,0,0) -- 1m -- C(2,0,0) -- 1m -- D(3,0,0)
  const nodes = [
    { id: 'A', floorId: 'F1', x: 0, y: 0, z: 0 },
    { id: 'B', floorId: 'F1', x: 1, y: 0, z: 0 },
    { id: 'C', floorId: 'F1', x: 2, y: 0, z: 0 },
    { id: 'D', floorId: 'F1', x: 3, y: 0, z: 0 },
  ];
  const edges = [
    { id: 'e1', from: 'A', to: 'B', weight: 1, bidirectional: true, wheelchairOk: true, type: 'walk' },
    { id: 'e2', from: 'B', to: 'C', weight: 1, bidirectional: true, wheelchairOk: true, type: 'walk' },
    { id: 'e3', from: 'C', to: 'D', weight: 1, bidirectional: true, wheelchairOk: true, type: 'walk' },
  ];
  const g = buildGraph(nodes, edges);

  test('tìm đường A→D', () => {
    const result = astar(g, 'A', 'D');
    assert.ok(result, 'Phải tìm ra đường');
    assert.deepEqual(result.path, ['A','B','C','D']);
    assert.equal(result.cost, 3);
  });

  test('A→A (cùng nút)', () => {
    const result = astar(g, 'A', 'A');
    assert.ok(result, 'Phải trả về path 1 nút');
    assert.deepEqual(result.path, ['A']);
  });

  test('node không tồn tại → null', () => {
    assert.equal(astar(g, 'A', 'Z'), null);
  });
});

// ─── Test: A* xe lăn không đi cầu thang ─────────────────────────────────────
describe('A* - xe lăn', () => {
  const nodes = [
    { id: 'F1_door', floorId: 'F1', x: 0, y: 0, z: 0 },
    { id: 'stair_F1', floorId: 'F1', x: 1, y: 0, z: 0 },
    { id: 'stair_F2', floorId: 'F2', x: 1, y: 3.6, z: 0 },
    { id: 'elev_F1',  floorId: 'F1', x: 5, y: 0, z: 0 },
    { id: 'elev_F2',  floorId: 'F2', x: 5, y: 3.6, z: 0 },
    { id: 'F2_room',  floorId: 'F2', x: 6, y: 3.6, z: 0 },
    { id: 'corridor_F1', floorId: 'F1', x: 3, y: 0, z: 0 },
  ];
  const edges = [
    { id: 'e1', from: 'F1_door', to: 'stair_F1', weight: 1, bidirectional: true, wheelchairOk: true, type: 'walk' },
    { id: 'e2', from: 'stair_F1', to: 'stair_F2', weight: 5, bidirectional: true, wheelchairOk: false, type: 'stairs' },
    { id: 'e3', from: 'F1_door', to: 'corridor_F1', weight: 2, bidirectional: true, wheelchairOk: true, type: 'walk' },
    { id: 'e4', from: 'corridor_F1', to: 'elev_F1', weight: 2, bidirectional: true, wheelchairOk: true, type: 'walk' },
    { id: 'e5', from: 'elev_F1', to: 'elev_F2', weight: 8, bidirectional: true, wheelchairOk: true, type: 'elevator' },
    { id: 'e6', from: 'elev_F2', to: 'F2_room', weight: 1, bidirectional: true, wheelchairOk: true, type: 'walk' },
    { id: 'e7', from: 'stair_F2', to: 'F2_room', weight: 1, bidirectional: true, wheelchairOk: true, type: 'walk' },
  ];
  const g = buildGraph(nodes, edges);

  test('chế độ thường: tìm ra đường qua cầu thang (ngắn hơn)', () => {
    const result = astar(g, 'F1_door', 'F2_room', { wheelchairOnly: false });
    assert.ok(result, 'Phải tìm ra đường');
    // Đường ngắn nhất qua stair: 1+5+1=7 vs thang máy: 2+2+8+1=13
    assert.ok(result.path.includes('stair_F1'), 'Nên đi qua cầu thang khi không phải xe lăn');
  });

  test('chế độ xe lăn: không đi cầu thang', () => {
    const result = astar(g, 'F1_door', 'F2_room', { wheelchairOnly: true });
    assert.ok(result, 'Phải tìm được đường');
    assert.ok(!result.path.includes('stair_F1'), 'Không được đi qua cầu thang');
    assert.ok(!result.path.includes('stair_F2'), 'Không được đi qua nút cầu thang F2');
    assert.ok(result.path.includes('elev_F1'), 'Phải đi qua thang máy');
  });

  test('chế độ xe lăn: không có đường → null khi chỉ có cầu thang', () => {
    // Graph chỉ có cầu thang, không có thang máy
    const n2 = [
      { id: 'start', floorId: 'F1', x: 0, y: 0, z: 0 },
      { id: 'stair1', floorId: 'F1', x: 1, y: 0, z: 0 },
      { id: 'stair2', floorId: 'F2', x: 1, y: 3.6, z: 0 },
      { id: 'end', floorId: 'F2', x: 2, y: 3.6, z: 0 },
    ];
    const e2 = [
      { id: 'walk', from: 'start', to: 'stair1', weight: 1, bidirectional: true, wheelchairOk: true, type: 'walk' },
      { id: 'stair', from: 'stair1', to: 'stair2', weight: 5, bidirectional: true, wheelchairOk: false, type: 'stairs' },
      { id: 'walk2', from: 'stair2', to: 'end', weight: 1, bidirectional: true, wheelchairOk: true, type: 'walk' },
    ];
    const g2 = buildGraph(n2, e2);
    const result = astar(g2, 'start', 'end', { wheelchairOnly: true });
    assert.equal(result, null, 'Phải trả về null khi không có đường xe lăn');
  });
});

// ─── Test: A* đa tầng với connector ───────────────────────────────────────────
describe('A* - đa tầng', () => {
  const nodes = [];
  const edges = [];
  // 3 tầng, thang máy nối F1→F2→F3, mỗi tầng có phòng
  for (let f = 1; f <= 3; f++) {
    nodes.push({ id: `F${f}_room`, floorId: `F${f}`, x: 0, y: (f-1)*3.6, z: 0 });
    nodes.push({ id: `F${f}_elev`, floorId: `F${f}`, x: 5, y: (f-1)*3.6, z: 0 });
    edges.push({ id: `F${f}_walk`, from: `F${f}_room`, to: `F${f}_elev`, weight: 5, bidirectional: true, wheelchairOk: true, type: 'walk' });
  }
  for (let f = 1; f <= 2; f++) {
    edges.push({ id: `elev_${f}`, from: `F${f}_elev`, to: `F${f+1}_elev`, weight: 10, bidirectional: true, wheelchairOk: true, type: 'elevator', connectorId: 'ELEV_A' });
  }
  const g = buildGraph(nodes, edges);

  test('F1_room → F3_room đi qua thang máy', () => {
    const result = astar(g, 'F1_room', 'F3_room');
    assert.ok(result, 'Phải tìm ra đường');
    assert.ok(result.path.includes('F1_elev'), 'Phải đi qua thang máy F1');
    assert.ok(result.path.includes('F3_elev'), 'Phải đi qua thang máy F3');
    assert.equal(result.path[0], 'F1_room');
    assert.equal(result.path[result.path.length - 1], 'F3_room');
  });
});

// ─── Test: generateInstructions ───────────────────────────────────────────────
describe('generateInstructions', () => {
  const nodes = [
    { id: 'A', floorId: 'F1', x: 0, y: 0, z: 0 },
    { id: 'B', floorId: 'F1', x: 5, y: 0, z: 0 },
    { id: 'C', floorId: 'F2', x: 5, y: 3.6, z: 0 },
  ];
  const edges = [
    { id: 'e1', from: 'A', to: 'B', weight: 5, bidirectional: true, wheelchairOk: true, type: 'walk' },
    { id: 'e2', from: 'B', to: 'C', weight: 10, bidirectional: true, wheelchairOk: true, type: 'elevator' },
  ];

  test('sinh chỉ dẫn từ A → C', () => {
    const steps = generateInstructions(nodes, edges);
    assert.ok(steps.length >= 2, 'Phải có ít nhất 2 bước');
    const hasArrival = steps.some(s => s.text.includes('đến nơi') || s.text.includes('đến'));
    assert.ok(hasArrival, 'Phải có bước đến nơi');
    const hasElevator = steps.some(s => s.icon === '🛗');
    assert.ok(hasElevator, 'Phải có bước thang máy');
  });

  test('path rỗng trả về []', () => {
    assert.deepEqual(generateInstructions([], edges), []);
    assert.deepEqual(generateInstructions([nodes[0]], edges), []);
  });
});

// ─── Test: Tween & TweenManager ──────────────────────────────────────────────
import { Tween, TweenManager, Easing } from '../src/utils/tween.js';

describe('Tween – easing', () => {
  test('linear: t=0 → 0, t=1 → 1', () => {
    assert.equal(Easing.linear(0), 0);
    assert.equal(Easing.linear(1), 1);
    assert.ok(Math.abs(Easing.linear(0.5) - 0.5) < 1e-9);
  });

  test('easeInOut: t=0.5 trả về 0.5 (đối xứng)', () => {
    assert.ok(Math.abs(Easing.easeInOut(0.5) - 0.5) < 1e-9);
    assert.equal(Easing.easeInOut(0), 0);
    assert.equal(Easing.easeInOut(1), 1);
  });

  test('easeOut: tốc độ giảm dần (f(0.9) > 0.9)', () => {
    assert.ok(Easing.easeOut(0.9) > 0.9, 'easeOut tại 0.9 phải > 0.9');
  });
});

describe('Tween – interpolate số', () => {
  test('từ 0 đến 100 trong 500ms', () => {
    const values = [];
    let completed = false;
    const tw = new Tween({
      from: 0, to: 100, duration: 500,
      easing: Easing.linear,
      onUpdate: v => values.push(v),
      onComplete: () => { completed = true; },
    });
    tw.start(0);
    tw.update(250); // 50% → giá trị 50
    assert.ok(values.length >= 1, 'Phải có giá trị update');
    assert.ok(Math.abs(values[0] - 50) < 0.01, 'Tại 50% phải = 50');
    tw.update(500); // done
    assert.ok(tw.done, 'Phải done sau 500ms');
    assert.ok(completed, 'onComplete phải được gọi');
    assert.ok(Math.abs(values[values.length - 1] - 100) < 0.01, 'Giá trị cuối phải = 100');
  });
});

describe('Tween – interpolate object {x,y}', () => {
  test('interpolate {x:0,y:0} → {x:10,y:20}', () => {
    let last;
    const tw = new Tween({
      from: { x: 0, y: 0 }, to: { x: 10, y: 20 },
      duration: 1000, easing: Easing.linear,
      onUpdate: v => { last = v; },
    });
    tw.start(0);
    tw.update(500);
    assert.ok(Math.abs(last.x - 5) < 0.01);
    assert.ok(Math.abs(last.y - 10) < 0.01);
  });
});

describe('Tween – cancel', () => {
  test('sau cancel: done = true, không gọi onComplete', () => {
    let completed = false;
    const tw = new Tween({
      from: 0, to: 1, duration: 500,
      onUpdate: () => {},
      onComplete: () => { completed = true; },
    });
    tw.start(0);
    tw.cancel();
    tw.update(600); // không nên làm gì
    assert.ok(tw.done, 'Phải done sau cancel');
    assert.ok(!completed, 'onComplete không được gọi');
  });
});

describe('TweenManager', () => {
  test('update trả về true khi có tween đang chạy', () => {
    const mgr = new TweenManager();
    const tw = new Tween({ from: 0, to: 1, duration: 200, onUpdate: ()=>{} });
    mgr.add(tw, 0);
    assert.ok(mgr.update(100), 'Còn tween đang chạy');
  });

  test('tween xong bị xóa khỏi manager', () => {
    const mgr = new TweenManager();
    const tw = new Tween({ from: 0, to: 1, duration: 100, onUpdate: ()=>{} });
    mgr.add(tw, 0);
    mgr.update(200); // done
    assert.equal(mgr.count, 0, 'Tween xong phải bị xóa');
  });

  test('cancelAll hủy toàn bộ', () => {
    const mgr = new TweenManager();
    mgr.add(new Tween({ from: 0, to: 1, duration: 300, onUpdate: ()=>{} }), 0);
    mgr.add(new Tween({ from: 0, to: 2, duration: 300, onUpdate: ()=>{} }), 0);
    mgr.cancelAll();
    assert.equal(mgr.count, 0);
  });
});

// ─── Test: splitRouteByFloor ──────────────────────────────────────────────────
import { splitRouteByFloor } from '../src/scene/SceneBuilder.js';

describe('splitRouteByFloor', () => {
  test('path cùng tầng → 1 segment', () => {
    const nodes = [
      { id: 'A', floorId: 'F1', x: 0, y: 0, z: 0 },
      { id: 'B', floorId: 'F1', x: 5, y: 0, z: 0 },
      { id: 'C', floorId: 'F1', x: 10, y: 0, z: 0 },
    ];
    const segs = splitRouteByFloor(nodes);
    assert.equal(segs.length, 1);
    assert.equal(segs[0].floorId, 'F1');
    assert.equal(segs[0].nodes.length, 3);
  });

  test('path qua 2 tầng → 2 segment (điểm nối chia sẻ)', () => {
    const nodes = [
      { id: 'A', floorId: 'F1', x: 0, y: 0, z: 0 },
      { id: 'B', floorId: 'F1', x: 5, y: 0, z: 0 },
      { id: 'E', floorId: 'F2', x: 5, y: 3.6, z: 0 },
      { id: 'C', floorId: 'F2', x: 10, y: 3.6, z: 0 },
    ];
    const segs = splitRouteByFloor(nodes);
    assert.equal(segs.length, 2);
    assert.equal(segs[0].floorId, 'F1');
    assert.equal(segs[1].floorId, 'F2');
    // Điểm E xuất hiện ở cuối segment F1 và đầu segment F2
    assert.equal(segs[0].nodes.at(-1).id, 'E');
    assert.equal(segs[1].nodes[0].id, 'E');
  });

  test('path < 2 nodes → []', () => {
    assert.deepEqual(splitRouteByFloor([]), []);
    assert.deepEqual(splitRouteByFloor([{ id: 'A', floorId: 'F1', x: 0, y: 0, z: 0 }]), []);
  });

  test('path qua 3 tầng → 3 segment', () => {
    const nodes = [
      { id: 'A', floorId: 'F1', x: 0, y: 0, z: 0 },
      { id: 'E12', floorId: 'F2', x: 5, y: 3.6, z: 0 },
      { id: 'E23', floorId: 'F3', x: 5, y: 7.2, z: 0 },
      { id: 'D', floorId: 'F3', x: 10, y: 7.2, z: 0 },
    ];
    const segs = splitRouteByFloor(nodes);
    assert.equal(segs.length, 3);
    assert.equal(segs[0].floorId, 'F1');
    assert.equal(segs[1].floorId, 'F2');
    assert.equal(segs[2].floorId, 'F3');
  });
});

// ─── Test: labelPriority ──────────────────────────────────────────────────────
import { labelPriority } from '../src/scene/SceneBuilder.js';

describe('labelPriority', () => {
  test('phòng được chọn có priority cao nhất', () => {
    const room = { id: 'R1', type: 'clinic' };
    assert.equal(labelPriority(room, true, null, null), 100);
  });

  test('loại quan trọng (elevator, wc, entrance) có priority trung bình', () => {
    for (const type of ['elevator', 'wc', 'entrance', 'info', 'stairs']) {
      const room = { id: 'R', type };
      const p = labelPriority(room, false, null, null);
      assert.equal(p, 50, `${type} phải là 50`);
    }
  });

  test('loại thường có priority thấp', () => {
    const room = { id: 'R', type: 'clinic' };
    assert.equal(labelPriority(room, false, null, null), 10);
  });

  test('selected > important > normal', () => {
    const pSel  = labelPriority({ type: 'clinic' }, true,  null, null);
    const pImp  = labelPriority({ type: 'wc' },     false, null, null);
    const pNorm = labelPriority({ type: 'clinic' }, false, null, null);
    assert.ok(pSel > pImp, 'selected > important');
    assert.ok(pImp > pNorm, 'important > normal');
  });
});
