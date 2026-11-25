import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMapFlow, STATES } from '../src/ui/mapFlow.js';
import { summarizeRoute, pathUsesStairs, remainingDistance, landmarkHint } from '../src/nav/route_summary.js';
import { scopeFloors } from '../src/ui/floorScope.js';
import { buildGraph, astar } from '../src/nav/astar.js';

const ROOM = { id: 'F1_R010', name: 'Phòng thử', floorId: 'F1' };
const MANUAL = { roomId: 'F1_R001', label: 'Phòng A', floorId: 'F1', source: 'manual' };

test('S0 -> S1 -> S2 -> S3 rồi back() lùi đúng stack; ở S0 vẫn S0', () => {
  const f = createMapFlow();
  assert.equal(f.state, STATES.EXPLORE);
  f.openSearch();
  assert.equal(f.state, STATES.SEARCH);
  f.selectDestination(ROOM, { via: 'search' });
  assert.equal(f.state, STATES.ROUTE);
  f.setStart(MANUAL);
  f.setRouteOk(true);
  f.startNavigation();
  assert.equal(f.state, STATES.NAV);
  assert.equal(f.back(), STATES.ROUTE);
  assert.equal(f.context.destination.roomId, ROOM.id, 'rời S3 về S2 giữ context');
  assert.equal(f.back(), STATES.SEARCH);
  assert.equal(f.back(), STATES.EXPLORE);
  assert.equal(f.context.destination, null, 'về S0 xóa điểm đến');
  assert.equal(f.context.start, null);
  assert.equal(f.back(), STATES.EXPLORE);
});

test('vào S2 từ chạm bản đồ thì back() về thẳng S0', () => {
  const f = createMapFlow();
  f.selectDestination(ROOM, { via: 'map' });
  assert.equal(f.state, STATES.ROUTE);
  assert.equal(f.context.entry, 'map');
  assert.equal(f.back(), STATES.EXPLORE);
});

test('tự điền điểm đến sau selectDestination', () => {
  const f = createMapFlow();
  f.openSearch('thu');
  f.selectDestination(ROOM);
  assert.equal(f.context.destination.roomId, ROOM.id);
  assert.equal(f.context.destination.label, ROOM.name);
});

test('fallback khi không có vị trí: không bắt đầu được, chọn thủ công thì đi được', () => {
  const f = createMapFlow();
  f.selectDestination(ROOM, { via: 'map' });
  f.autoFillStart(null);
  assert.equal(f.context.start, null);
  assert.equal(f.canStartNav(), false);
  f.setRouteOk(true);
  f.startNavigation();
  assert.equal(f.state, STATES.ROUTE, 'startNavigation không đổi state khi thiếu điểm xuất phát');
  f.setStart(MANUAL);
  f.setRouteOk(true);
  assert.equal(f.canStartNav(), true);
  f.startNavigation();
  assert.equal(f.state, STATES.NAV);
});

test('autoFillStart không ghi đè start người dùng đã chọn; swap đổi hai đầu', () => {
  const f = createMapFlow();
  f.selectDestination(ROOM, { via: 'map' });
  f.swap();
  assert.equal(f.context.destination.roomId, ROOM.id, 'swap khi thiếu một đầu: không đổi');
  assert.equal(f.context.start, null);
  f.setStart(MANUAL);
  f.autoFillStart({ roomId: 'F1_R999', label: 'Khác', source: 'ble' });
  assert.equal(f.context.start.roomId, MANUAL.roomId);
  f.swap();
  assert.equal(f.context.start.roomId, ROOM.id);
  assert.equal(f.context.destination.roomId, MANUAL.roomId);
});

test('chuyển trạng thái không hợp lệ bị bỏ qua, không ném lỗi', () => {
  const f = createMapFlow();
  f.startNavigation();
  assert.equal(f.state, STATES.EXPLORE);
  f.beginPickStart();
  assert.equal(f.context.pickingStart, false);
  f.selectDestination(null);
  assert.equal(f.state, STATES.EXPLORE);
});

test('onChange báo pushed đúng và wheelchair được giữ khi reset', () => {
  const events = [];
  const f = createMapFlow({ onChange: (s, c, o) => events.push([s, o.pushed]) });
  f.setWheelchair(true);
  f.openSearch();
  f.back();
  f.reset();
  assert.equal(f.context.wheelchair, true);
  assert.deepEqual(events.filter((e) => e[1]).map((e) => e[0]), ['S1']);
});

test('summarizeRoute: tuyến F1 -> F3 qua thang máy', () => {
  const nodes = [
    { id: 'a', floorId: 'F1', x: 0, y: 0, z: 0 },
    { id: 'b', floorId: 'F1', x: 3, y: 0, z: 4 },
    { id: 'c', floorId: 'F2', x: 3, y: 3.6, z: 4 },
    { id: 'd', floorId: 'F3', x: 3, y: 7.2, z: 4 },
    { id: 'e', floorId: 'F3', x: 3, y: 7.2, z: 10 },
  ];
  const edges = [
    { from: 'a', to: 'b', type: 'walk', bidirectional: true },
    { from: 'b', to: 'c', type: 'elevator', bidirectional: true },
    { from: 'c', to: 'd', type: 'elevator', bidirectional: true },
    { from: 'd', to: 'e', type: 'walk', bidirectional: true },
  ];
  const s = summarizeRoute(nodes, edges);
  assert.equal(s.floorChanges, 2);
  assert.ok(Math.abs(s.distanceM - (5 + 3.6 + 3.6 + 6)) < 1e-9);
  assert.equal(s.transitions[0].type, 'elevator');
  assert.equal(s.transitions[0].up, true);
  assert.equal(s.transitions[0].toFloor, 'F2');
  assert.ok(Math.abs(remainingDistance(nodes, 3) - 6) < 1e-9);
  assert.ok(Math.abs(remainingDistance(nodes, 0) - s.distanceM) < 1e-9);
});

test('pathUsesStairs true với cạnh stairs, false với thang máy', () => {
  const edges = [
    { from: 'a', to: 'b', type: 'stairs', bidirectional: true },
    { from: 'b', to: 'c', type: 'elevator', bidirectional: true },
  ];
  assert.equal(pathUsesStairs(['a', 'b'], edges), true);
  assert.equal(pathUsesStairs(['c', 'b', 'a'], edges), true, 'tính cả chiều ngược (bidirectional)');
  assert.equal(pathUsesStairs(['b', 'c'], edges), false);
});

test('landmarkHint trả tên phòng khi node là doorNodeId, mặc định khi không có', () => {
  const rooms = [{ id: 'F1_R001', name: 'Phòng A', floorId: 'F1', doorNodeId: 'F1_D001' }];
  assert.match(landmarkHint({ nodeId: 'F1_D001' }, { rooms, nodes: [] }), /Phòng A/);
  assert.equal(landmarkHint({ nodeId: 'F1_N999' }, { rooms, nodes: [] }), 'Đi tới mốc tiếp theo');
  assert.equal(landmarkHint({}, { rooms, nodes: [] }), 'Đi tới mốc tiếp theo');
});

test('dữ liệu thật: tuyến xe lăn không dùng cạnh stairs (mọi phòng F2/F3 từ một phòng F1)', async () => {
  const source = {};
  for (const name of ['floors', 'rooms', 'nodes', 'edges', 'connectors', 'beacons']) {
    source[name] = JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url)));
  }
  source.coordSys = JSON.parse(await readFile(new URL('../data/coordinate_system.json', import.meta.url)));
  const data = scopeFloors(source);
  const graph = buildGraph(data.nodes, data.edges);
  const from = data.rooms.find((r) => r.floorId === 'F1' && r.doorNodeId);
  const targets = data.rooms.filter((r) => (r.floorId === 'F2' || r.floorId === 'F3') && r.doorNodeId);
  assert.ok(targets.length > 0);
  const byNode = new Map(data.nodes.map((n) => [n.id, n]));
  let checked = 0;
  let crossFloor = 0;
  for (const to of targets) {
    const route = astar(graph, from.doorNodeId, to.doorNodeId, { wheelchairOnly: true });
    if (!route) continue;
    checked++;
    assert.equal(pathUsesStairs(route.path, data.edges), false, `${to.id}: không dùng cầu thang`);
    for (let i = 0; i < route.path.length - 1; i++) {
      const a = route.path[i], b = route.path[i + 1];
      const ok = data.edges.some((e) => ((e.from === a && e.to === b) || (e.bidirectional && e.from === b && e.to === a))
        && e.wheelchairOk === true && e.type !== 'stairs');
      assert.ok(ok, `${to.id}: ${a}->${b} cần cạnh wheelchairOk không phải stairs`);
    }
    const nodes = route.path.map((id) => byNode.get(id));
    if (summarizeRoute(nodes, data.edges).floorChanges >= 1) crossFloor++;
  }
  assert.ok(checked > 0, 'có tuyến để kiểm');
  assert.ok(crossFloor >= 1, 'có ít nhất một tuyến đổi tầng');
  console.log(`# tuyến xe lăn đã kiểm: ${checked}/${targets.length}, đổi tầng: ${crossFloor}`);
});
