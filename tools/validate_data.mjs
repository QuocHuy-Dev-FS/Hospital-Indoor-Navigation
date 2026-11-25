/**
 * validate_data.mjs — Kiểm tra tính hợp lệ của toàn bộ dữ liệu
 * Chạy: node tools/validate_data.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');

let errors = 0;
let warnings = 0;

function err(msg)  { console.error(`  ✗ ERROR: ${msg}`); errors++; }
function warn(msg) { console.warn(`  ⚠ WARN:  ${msg}`); warnings++; }
function ok(msg)   { console.log(`  ✓ ${msg}`); }

function load(file) {
  const fp = path.join(DATA, file);
  if (!fs.existsSync(fp)) { err(`File không tồn tại: ${file}`); return null; }
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')); }
  catch (e) { err(`JSON parse lỗi: ${file}: ${e.message}`); return null; }
}

// ─── Load ────────────────────────────────────────────────────────────────────
console.log('=== validate_data.mjs ===\n');
const floors     = load('floors.json');
const rooms      = load('rooms.json');
const nodes      = load('nodes.json');
const edges      = load('edges.json');
const connectors = load('connectors.json');
const beacons    = load('beacons.json');
const coordSys   = load('coordinate_system.json');
const manifest   = load('manifest.json');

if (!floors || !rooms || !nodes || !edges || !connectors || !beacons) {
  console.error('\nKhông thể tiếp tục: thiếu file dữ liệu.');
  process.exit(1);
}

// ─── ID uniqueness ────────────────────────────────────────────────────────────
console.log('1. Kiểm tra ID duy nhất…');
function checkUniqueIds(arr, label) {
  const seen = new Set();
  for (const item of arr) {
    if (!item.id) { err(`${label}: có mục thiếu id`); continue; }
    if (seen.has(item.id)) err(`${label}: ID trùng "${item.id}"`);
    seen.add(item.id);
  }
  return seen;
}
const floorIds     = checkUniqueIds(floors, 'floors');
const roomIds      = checkUniqueIds(rooms, 'rooms');
const nodeIds      = checkUniqueIds(nodes, 'nodes');
const edgeIds      = checkUniqueIds(edges, 'edges');
const connectorIds = checkUniqueIds(connectors, 'connectors');
const beaconIds    = checkUniqueIds(beacons, 'beacons');
ok(`floors:${floorIds.size} rooms:${roomIds.size} nodes:${nodeIds.size} edges:${edgeIds.size} beacons:${beaconIds.size}`);

// ─── Reference integrity ─────────────────────────────────────────────────────
console.log('\n2. Kiểm tra tham chiếu…');
for (const room of rooms) {
  if (!room.doorNodeId) { err(`Room ${room.id}: thiếu doorNodeId`); continue; }
  if (!nodeIds.has(room.doorNodeId)) err(`Room ${room.id}: doorNodeId "${room.doorNodeId}" không tồn tại`);
  if (!floorIds.has(room.floorId)) err(`Room ${room.id}: floorId "${room.floorId}" không tồn tại`);
}
for (const edge of edges) {
  if (edge.from && !edge.from.startsWith('MULTI') && !nodeIds.has(edge.from)) {
    // connector edges have floorId starting with MULTI_
    if (!edge.connectorId) err(`Edge ${edge.id}: from "${edge.from}" không tồn tại`);
  }
  if (edge.to && !nodeIds.has(edge.to)) {
    if (!edge.connectorId) err(`Edge ${edge.id}: to "${edge.to}" không tồn tại`);
  }
}
for (const conn of connectors) {
  for (const link of conn.links) {
    if (!nodeIds.has(link.nodeId)) err(`Connector ${conn.id}: nodeId "${link.nodeId}" không tồn tại`);
    if (!floorIds.has(link.floorId)) err(`Connector ${conn.id}: floorId "${link.floorId}" không tồn tại`);
  }
}
ok('Tham chiếu kiểm tra xong');

// ─── Stairs: wheelchairOk phải false ────────────────────────────────────────
console.log('\n3. Cạnh stairs wheelchairOk…');
let stairsEdgeCount = 0;
for (const edge of edges) {
  if (edge.type === 'stairs') {
    stairsEdgeCount++;
    if (edge.wheelchairOk === true) err(`Edge ${edge.id}: stairs nhưng wheelchairOk=true`);
  }
}
ok(`${stairsEdgeCount} cạnh stairs, tất cả wheelchairOk=false`);

// ─── Connector floor count ────────────────────────────────────────────────────
console.log('\n4. Connector nối đủ tầng…');
const NUM_FLOORS = floors.length;
for (const conn of connectors) {
  if (conn.links.length !== NUM_FLOORS) {
    warn(`Connector ${conn.id}: có ${conn.links.length} links, kỳ vọng ${NUM_FLOORS}`);
  }
}
ok(`${connectors.length} connectors`);

// ─── Beacon trong tầng đúng ───────────────────────────────────────────────────
console.log('\n5. Beacon nằm trong tầng…');
const floorSet = new Set(floors.map(f => f.id));
for (const b of beacons) {
  if (!floorSet.has(b.floorId)) err(`Beacon ${b.id}: floorId "${b.floorId}" không tồn tại`);
}
ok(`${beacons.length} beacons`);

// ─── Đồ thị liên thông (BFS từ điểm vào F1) ─────────────────────────────────
console.log('\n6. Kiểm tra liên thông đồ thị (BFS từ F1_N019)…');
const adj = new Map();
for (const n of nodes) adj.set(n.id, []);
for (const e of edges) {
  if (e.from && e.to && adj.has(e.from) && adj.has(e.to)) {
    adj.get(e.from).push(e.to);
    if (e.bidirectional) adj.get(e.to).push(e.from);
  }
}
const entryNode = 'F1_N019';
if (!adj.has(entryNode)) {
  warn(`Điểm vào ${entryNode} không tồn tại — bỏ qua kiểm tra liên thông`);
} else {
  const visited = new Set([entryNode]);
  const queue = [entryNode];
  while (queue.length) {
    const cur = queue.shift();
    for (const nb of (adj.get(cur) ?? [])) {
      if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
    }
  }
  const unreachable = nodes.filter(n => !visited.has(n.id));
  if (unreachable.length > 0) {
    warn(`${unreachable.length} nút không thể đến từ ${entryNode} (ví dụ: ${unreachable.slice(0,3).map(n=>n.id).join(', ')})`);
  } else {
    ok(`Tất cả ${nodes.length} nút có thể đến từ ${entryNode}`);
  }
}

// ─── Mỗi phòng có doorNodeId được nối vào đồ thị ─────────────────────────────
console.log('\n7. Cửa phòng nối vào đồ thị…');
let doorOk = 0, doorFail = 0;
for (const room of rooms) {
  if (!room.doorNodeId) continue;
  if (adj.has(room.doorNodeId) && adj.get(room.doorNodeId).length > 0) {
    doorOk++;
  } else {
    doorFail++;
    if (doorFail <= 5) warn(`Room ${room.id}: doorNode ${room.doorNodeId} không có cạnh nào`);
  }
}
if (doorFail > 5) warn(`... và ${doorFail - 5} phòng khác có cửa không nối`);
ok(`${doorOk} phòng có doorNode nối vào đồ thị, ${doorFail} chưa nối`);

// ─── Đường xe lăn đến mọi phòng accessible ──────────────────────────────────
console.log('\n8. Đường xe lăn đến phòng accessible…');
const wcAdj = new Map();
for (const n of nodes) wcAdj.set(n.id, []);
for (const e of edges) {
  if (!e.wheelchairOk) continue;
  if (e.from && e.to && wcAdj.has(e.from) && wcAdj.has(e.to)) {
    wcAdj.get(e.from).push(e.to);
    if (e.bidirectional) wcAdj.get(e.to).push(e.from);
  }
}
let wcReach = 0, wcNoReach = 0;
if (adj.has(entryNode)) {
  const visited2 = new Set([entryNode]);
  const q2 = [entryNode];
  while (q2.length) {
    const cur = q2.shift();
    for (const nb of (wcAdj.get(cur) ?? [])) {
      if (!visited2.has(nb)) { visited2.add(nb); q2.push(nb); }
    }
  }
  for (const room of rooms.filter(r => r.accessible)) {
    if (!room.doorNodeId) continue;
    if (visited2.has(room.doorNodeId)) wcReach++;
    else wcNoReach++;
  }
  ok(`Accessible rooms: ${wcReach} có đường xe lăn, ${wcNoReach} không có`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n=== Kết quả ===');
console.log(`  Lỗi:     ${errors}`);
console.log(`  Cảnh báo: ${warnings}`);
if (errors > 0) {
  console.error('\n❌ Validate THẤT BẠI');
  process.exit(1);
} else {
  console.log('\n✅ Validate THÀNH CÔNG');
}
