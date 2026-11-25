import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  normalizeCode, lookupPlan, validatePlan, sortedSteps, computeSegmentRoute, createVisitTracker,
} from '../src/visit/visit_plan.js';
import { buildGraph } from '../src/nav/astar.js';
import { pathUsesStairs } from '../src/nav/route_summary.js';

const PLANS = [
  { code: 'DEMO-0001', steps: [{ order: 2, roomId: 'B' }, { order: 1, roomId: 'A' }, { order: 3, roomId: 'C' }] },
  { code: 'DEMO-0002', steps: [{ order: 1, roomId: 'A' }] },
];
const ROOMS = ['A', 'B', 'C', 'D'].map((id) => ({ id }));

test('chuẩn hóa mã: hoa/thường, khoảng trắng, gạch', () => {
  for (const raw of ['DEMO-0001', 'demo-0001', ' demo 0001 ', 'DEMO0001', 'Demo_0001', 'demo - 0001', 'DEMO.0001']) {
    assert.equal(normalizeCode(raw), 'DEMO-0001', raw);
  }
});

test('chuẩn hóa mã: ký tự dễ nhầm O/0, I/1/l', () => {
  assert.equal(normalizeCode('DEMO-OOO1'), 'DEMO-0001');
  assert.equal(normalizeCode('DEM0-0001'), 'DEMO-0001');
  assert.equal(normalizeCode('demo-ooo1'), 'DEMO-0001');
  assert.equal(normalizeCode('DEMO-IOOl'), 'DEMO-1001');
  assert.equal(normalizeCode('DEMO-l0l0'), 'DEMO-1010');
  assert.equal(normalizeCode('DEMO-0I02'), 'DEMO-0102');
});

test('chuẩn hóa mã: đầu vào sai trả null, không ném', () => {
  for (const raw of [null, undefined, 42, {}, '', '   ', '0001', 'DEMO', 'DEMO-12', 'DEMO-12AB', 'DEMO-', '--']) {
    assert.equal(normalizeCode(raw), null, String(raw));
  }
});

test('tra cứu mã hợp lệ, bất kể hoa/thường/khoảng trắng', () => {
  const r = lookupPlan(PLANS, ' demo 0002 ');
  assert.equal(r.ok, true);
  assert.equal(r.plan.code, 'DEMO-0002');
});

test('mã không tồn tại trả lỗi rõ, không ném', () => {
  assert.deepEqual(lookupPlan(PLANS, 'DEMO-9999'), { ok: false, error: 'not-found' });
  assert.deepEqual(lookupPlan(PLANS, 'abc'), { ok: false, error: 'format' });
  assert.deepEqual(lookupPlan(PLANS, ''), { ok: false, error: 'empty' });
  assert.deepEqual(lookupPlan(PLANS, '   '), { ok: false, error: 'empty' });
  assert.deepEqual(lookupPlan(PLANS, undefined), { ok: false, error: 'empty' });
  assert.doesNotThrow(() => lookupPlan(null, 'DEMO-0001'));
  assert.deepEqual(lookupPlan(null, 'DEMO-0001'), { ok: false, error: 'not-found' });
  assert.doesNotThrow(() => lookupPlan([null, {}, { code: 5 }], 'DEMO-0001'));
});

test('tôn trọng order, không theo thứ tự mảng', () => {
  assert.deepEqual(sortedSteps(PLANS[0]).map((s) => s.roomId), ['A', 'B', 'C']);
  assert.deepEqual(sortedSteps(null), []);
});

test('lịch trình hợp lệ qua kiểm tra', () => {
  assert.deepEqual(validatePlan(PLANS[0], ROOMS), { ok: true, errors: [] });
  assert.equal(validatePlan(PLANS[0], new Set(['A', 'B', 'C'])).ok, true);
});

test('roomId không tồn tại bị phát hiện', () => {
  const v = validatePlan({ code: 'X', steps: [{ order: 1, roomId: 'A' }, { order: 2, roomId: 'ZZZ' }] }, ROOMS);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.type === 'unknown-room' && e.roomId === 'ZZZ'));
});

test('roomId trùng liên tiếp (sau khi sắp theo order) bị phát hiện', () => {
  const v = validatePlan({ code: 'X', steps: [{ order: 2, roomId: 'A' }, { order: 1, roomId: 'A' }, { order: 3, roomId: 'B' }] }, ROOMS);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.type === 'duplicate-consecutive'));
  const okNonConsecutive = validatePlan({ code: 'X', steps: [{ order: 1, roomId: 'A' }, { order: 2, roomId: 'B' }, { order: 3, roomId: 'A' }] }, ROOMS);
  assert.equal(okNonConsecutive.ok, true);
});

test('lịch trình rỗng, order trùng hoặc không phải số bị phát hiện', () => {
  assert.ok(validatePlan({ code: 'X', steps: [] }, ROOMS).errors.some((e) => e.type === 'empty'));
  assert.ok(validatePlan({ code: 'X' }, ROOMS).errors.some((e) => e.type === 'empty'));
  assert.ok(validatePlan({ steps: [{ order: 1, roomId: 'A' }, { order: 1, roomId: 'B' }] }, ROOMS).errors.some((e) => e.type === 'duplicate-order'));
  assert.ok(validatePlan({ steps: [{ order: 'x', roomId: 'A' }] }, ROOMS).errors.some((e) => e.type === 'bad-order'));
});

test('chặng kế tính đúng từ phòng hiện tại', () => {
  const t = createVisitTracker(PLANS[0]);
  assert.equal(t.state, 'idle');
  assert.equal(t.segment(), null);
  t.setStart('D');
  let seg = t.segment();
  assert.deepEqual([seg.number, seg.total, seg.fromRoomId, seg.toRoomId], [1, 3, 'D', 'A']);
  seg = t.complete();
  assert.deepEqual([seg.number, seg.fromRoomId, seg.toRoomId], [2, 'A', 'B']);
  seg = t.complete();
  assert.deepEqual([seg.number, seg.fromRoomId, seg.toRoomId], [3, 'B', 'C']);
});

test('hoàn tất lịch trình', () => {
  const t = createVisitTracker(PLANS[0]);
  t.setStart('D');
  t.complete(); t.complete();
  assert.equal(t.complete(), null);
  assert.equal(t.state, 'finished');
  assert.equal(t.segment(), null);
  assert.ok(t.steps.every((s) => s.status === 'done'));
  assert.equal(t.position, 'C');
  assert.equal(t.complete(), null, 'gọi thêm không ném, không đổi');
});

test('bỏ qua chặng: vị trí không đổi, chặng sau tính từ vị trí cũ', () => {
  const t = createVisitTracker(PLANS[0]);
  t.setStart('D');
  const seg = t.skip();
  assert.deepEqual([seg.number, seg.fromRoomId, seg.toRoomId], [2, 'D', 'B']);
  assert.equal(t.steps[0].status, 'skipped');
});

test('chặng bỏ qua không tự quay lại; goTo mở lại đúng chặng', () => {
  const t = createVisitTracker(PLANS[0]);
  t.setStart('D');
  t.skip();                          // A skipped
  t.complete();                      // B done, pos B
  t.complete();                      // C done, pos C
  assert.equal(t.state, 'finished');
  const seg = t.goTo(0);
  assert.deepEqual([seg.number, seg.fromRoomId, seg.toRoomId], [1, 'C', 'A']);
  assert.equal(t.state, 'active');
  assert.equal(t.complete(), null);
  assert.equal(t.state, 'finished');
});

test('back() quay về chặng liền trước; ở chặng 1 không đổi; goTo sai chỉ số không ném', () => {
  const t = createVisitTracker(PLANS[0]);
  t.setStart('D');
  t.complete();
  const seg = t.back();
  assert.equal(seg.number, 1);
  assert.equal(t.back().number, 1);
  assert.doesNotThrow(() => t.goTo(99));
  assert.doesNotThrow(() => t.goTo(-1));
  assert.doesNotThrow(() => t.goTo(1.5));
});

test('onChange được gọi khi đổi trạng thái', () => {
  let n = 0;
  const t = createVisitTracker(PLANS[1], { onChange: () => { n++; } });
  t.setStart('D'); t.complete();
  assert.equal(n, 2);
});

// ── Định tuyến: xe lăn không qua cầu thang ──
const N = (id, x, floorId, y = 0) => ({ id, x, y, z: 0, floorId });
const NODES = [N('a', 0, 'F1'), N('b', 10, 'F1'), N('c', 0, 'F2', 4), N('d', 10, 'F2', 4)];
const ROOMS_G = [
  { id: 'F1_R001', doorNodeId: 'a' }, { id: 'F1_R002', doorNodeId: 'b' },
  { id: 'F2_R001', doorNodeId: 'c' }, { id: 'F2_R002', doorNodeId: 'd' }, { id: 'F2_R003' },
];
const E = (id, from, to, type, wheelchairOk) => ({ id, from, to, weight: 5, bidirectional: true, type, wheelchairOk });

test('xe lăn: chọn thang máy thay vì cầu thang khi cả hai có', () => {
  const edges = [E('e1', 'a', 'b', 'corridor', true), E('s1', 'a', 'c', 'stairs', false), E('l1', 'b', 'd', 'elevator', true), E('e2', 'c', 'd', 'corridor', true)];
  const ctx = { rooms: ROOMS_G, nodes: NODES, edges, graph: buildGraph(NODES, edges) };
  const r = computeSegmentRoute(ctx, 'F1_R001', 'F2_R002', true);
  assert.equal(r.ok, true);
  assert.equal(pathUsesStairs(r.path, edges), false);
});

test('xe lăn: chỉ có cầu thang thì báo no-route; người đi bộ vẫn đi được', () => {
  const edges = [E('s1', 'a', 'c', 'stairs', false), E('e2', 'c', 'd', 'corridor', true), E('e1', 'a', 'b', 'corridor', true)];
  const ctx = { rooms: ROOMS_G, nodes: NODES, edges, graph: buildGraph(NODES, edges) };
  assert.deepEqual(computeSegmentRoute(ctx, 'F1_R001', 'F2_R002', true), { ok: false, error: 'no-route' });
  const walk = computeSegmentRoute(ctx, 'F1_R001', 'F2_R002', false);
  assert.equal(walk.ok, true);
  assert.equal(pathUsesStairs(walk.path, edges), true);
});

test('xe lăn: cạnh cầu thang bị gắn nhầm wheelchairOk vẫn bị chặn (phòng thủ pathUsesStairs)', () => {
  const edges = [E('s1', 'a', 'c', 'stairs', true), E('e2', 'c', 'd', 'corridor', true)];
  const ctx = { rooms: ROOMS_G, nodes: NODES, edges, graph: buildGraph(NODES, edges) };
  assert.deepEqual(computeSegmentRoute(ctx, 'F1_R001', 'F2_R002', true), { ok: false, error: 'no-route' });
});

test('computeSegmentRoute: same / no-door không ném', () => {
  const edges = [E('e1', 'a', 'b', 'corridor', true)];
  const ctx = { rooms: ROOMS_G, nodes: NODES, edges, graph: buildGraph(NODES, edges) };
  assert.equal(computeSegmentRoute(ctx, 'F1_R001', 'F1_R001').error, 'same');
  assert.equal(computeSegmentRoute(ctx, 'F1_R001', 'F2_R003').error, 'no-door');
  assert.equal(computeSegmentRoute(ctx, 'F1_R001', 'NOPE').error, 'no-door');
  assert.equal(computeSegmentRoute(null, 'F1_R001', 'F1_R002').error, 'no-door');
});

// ── Dữ liệu mẫu và quyền riêng tư ──
test('data/visit_plans.sample.json: mã DEMO, phòng tồn tại, hợp lệ, có tuyến', async () => {
  const sample = JSON.parse(await readFile(new URL('../data/visit_plans.sample.json', import.meta.url), 'utf8'));
  const rooms = JSON.parse(await readFile(new URL('../data/rooms.json', import.meta.url), 'utf8'));
  const nodes = JSON.parse(await readFile(new URL('../data/nodes.json', import.meta.url), 'utf8'));
  const edges = JSON.parse(await readFile(new URL('../data/edges.json', import.meta.url), 'utf8'));
  const ctx = { rooms, nodes, edges, graph: buildGraph(nodes, edges) };
  const codes = sample.plans.map((p) => p.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(sample.plans.length >= 2);
  for (const p of sample.plans) {
    assert.match(p.code, /^DEMO-\d{4}$/);
    assert.deepEqual(validatePlan(p, rooms), { ok: true, errors: [] }, p.code);
    const steps = sortedSteps(p);
    for (let i = 0; i < steps.length - 1; i++) {
      assert.equal(computeSegmentRoute(ctx, steps[i].roomId, steps[i + 1].roomId, false).ok, true, `${p.code} chặng ${i + 1}->${i + 2}`);
    }
  }
  assert.equal(lookupPlan(sample.plans, 'demo 0001').ok, true);
});

test('không truy cập storage/cookie/console khi tra cứu và chạy máy trạng thái', async () => {
  const trap = () => { throw new Error('truy cập storage bị cấm'); };
  const saved = {};
  for (const k of ['localStorage', 'sessionStorage', 'document']) {
    saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    Object.defineProperty(globalThis, k, { configurable: true, get: trap });
  }
  try {
    lookupPlan(PLANS, 'DEMO-0001');
    const t = createVisitTracker(PLANS[0]);
    t.setStart('D'); t.skip(); t.complete(); t.goTo(0); t.complete(); t.complete();
    validatePlan(PLANS[0], ROOMS);
  } finally {
    for (const [k, d] of Object.entries(saved)) {
      if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k];
    }
  }
  for (const f of ['../src/visit/visit_plan.js', '../src/ui/visitUI.js']) {
    const src = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /localStorage|sessionStorage|document\.cookie|indexedDB|console\.|history\.(push|replace)State|location\.(href|search|hash)\s*=/, f);
  }
});
