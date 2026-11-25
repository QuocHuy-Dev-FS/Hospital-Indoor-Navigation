/**
 * generate_data.mjs
 * Sinh toàn bộ dữ liệu từ floor template, ghi vào data/*.json
 * Chạy: node tools/generate_data.mjs
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

// ─── Hệ tọa độ (Cần xác nhận) ──────────────────────────────────────────────
const COORD = {
  M_PER_PX: 0.02,           // Cần xác nhận: tỉ lệ thực
  IMG_W_PX: 1746,            // chiều rộng ảnh
  IMG_H_PX: 2096,            // chiều cao ảnh
  FLOOR_HEIGHT_M: 3.6,       // Cần xác nhận
  WALL_HEIGHT_M: 3.0,        // Cần xác nhận
  WALL_THICKNESS_M: 0.2,     // Cần xác nhận
  TOTAL_FLOORS: 9,
  ENTRY_NOTE: 'Cần xác nhận: điểm vào thực tế của tòa nhà',
};

function px(v) { return +(v * COORD.M_PER_PX).toFixed(3); }

// ─── Mô tả phòng theo mặt bằng điển hình (pixel) ──────────────────────────
// Mỗi phòng: { id_suffix, x1, y1, x2, y2, name, type, accessible, unlabeled? }
const ROOM_TEMPLATE = [
  // Dãy Bắc (y 0–312 px) ─────────────────────────────────────────────────
  { id_suffix: 'R001', x1:   0, y1:  0, x2: 338, y2: 312, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R002', x1: 338, y1:  0, x2: 490, y2: 312, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R003', x1: 490, y1:  0, x2: 657, y2: 312, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R004', x1: 657, y1:  0, x2: 816, y2: 312, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R005', x1: 816, y1:  0, x2: 977, y2: 312, name: 'Phòng Trưởng ban',   type: 'office', accessible: true },
  { id_suffix: 'R006', x1: 977, y1:  0, x2:1135, y2: 312, name: 'Phòng kỹ thuật',     type: 'office', accessible: true },
  { id_suffix: 'R007', x1:1135, y1:  0, x2:1295, y2: 157, name: 'WC Nam',             type: 'wc',    accessible: false },
  { id_suffix: 'R008', x1:1135, y1:157, x2:1295, y2: 315, name: 'WC Nữ',              type: 'wc',    accessible: false },

  // Hành chính + điều hành (y 442–743 px) ─────────────────────────────────
  { id_suffix: 'R009', x1: 500, y1: 442, x2:  975, y2: 743, name: 'Phòng Hành chính', type: 'office', accessible: true },
  { id_suffix: 'R010', x1: 975, y1: 442, x2: 1295, y2: 743, name: 'Phòng Điều hành', type: 'office', accessible: true },

  // Phòng lớn bên trái (y 446–1640 px) ────────────────────────────────────
  { id_suffix: 'R011', x1:  22, y1: 446, x2:  333, y2:1640, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },

  // Khối thang bộ giữa (y 846–1210 px) ─────────────────────────────────────
  { id_suffix: 'R012', x1: 497, y1: 846, x2:  948, y2:1210, name: 'Cầu thang giữa', type: 'stairs', accessible: false },

  // Khối thang máy / thông tầng (y 846–1210 px) ── Cần xác nhận loại ───────
  { id_suffix: 'R013', x1: 948, y1: 846, x2: 1320, y2:1210, name: 'Thang máy / Giếng trời', type: 'elevator', accessible: true },

  // Dãy dưới-giữa 5 phòng nhỏ (y 1349–1497 px) ────────────────────────────
  { id_suffix: 'R014', x1:  500, y1:1349, x2:  662, y2:1497, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R015', x1:  662, y1:1349, x2:  822, y2:1497, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R016', x1:  822, y1:1349, x2:  982, y2:1497, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R017', x1:  982, y1:1349, x2: 1137, y2:1497, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R018', x1: 1137, y1:1349, x2: 1291, y2:1497, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },

  // 4 phòng dọc lớn dưới (y 1582–2000 px) ──────────────────────────────────
  { id_suffix: 'R019', x1:  497, y1:1582, x2:  663, y2:2000, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R020', x1:  663, y1:1582, x2:  816, y2:2000, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R021', x1:  816, y1:1582, x2:  975, y2:2000, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R022', x1:  975, y1:1582, x2: 1133, y2:2000, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },

  // Cột nhỏ bên phải dưới (~4 phòng, y 1497–2000 px) ──────────────────────
  { id_suffix: 'R023', x1: 1133, y1:1497, x2: 1295, y2:1623, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R024', x1: 1133, y1:1623, x2: 1295, y2:1749, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R025', x1: 1133, y1:1749, x2: 1295, y2:1875, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R026', x1: 1133, y1:1875, x2: 1295, y2:2000, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },

  // Khu dưới-trái ────────────────────────────────────────────────────────────
  { id_suffix: 'R027', x1:   0, y1:1785, x2:  343, y2:1883, name: 'Trung Tâm dữ liệu', type: 'office', accessible: true },
  { id_suffix: 'R028', x1: 343, y1:1785, x2:  496, y2:2096, name: 'Kho',               type: 'storage', accessible: true },
  { id_suffix: 'R029', x1:   0, y1:1883, x2:  343, y2:2096, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },

  // Dải Đông (x 1425–1746 px) – 9 phòng ─────────────────────────────────────
  { id_suffix: 'R030', x1:1425, y1: 313, x2:1746, y2: 443, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R031', x1:1425, y1: 443, x2:1746, y2: 599, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R032', x1:1425, y1: 599, x2:1746, y2: 747, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R033', x1:1425, y1: 747, x2:1746, y2: 900, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R034', x1:1425, y1: 900, x2:1746, y2:1042, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R035', x1:1425, y1:1042, x2:1746, y2:1197, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R036', x1:1425, y1:1197, x2:1746, y2:1347, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R037', x1:1425, y1:1347, x2:1746, y2:1497, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
  { id_suffix: 'R038', x1:1425, y1:1497, x2:1746, y2:1780, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },

  // Thang bộ góc Đông-Bắc ──────────────────────────────────────────────────
  { id_suffix: 'R039', x1:1585, y1:  0, x2:1746, y2: 313, name: 'Cầu thang Đông-Bắc', type: 'stairs', accessible: false },
  // ô X kèm cạnh ─────────────────────────────────────────────────────────────
  { id_suffix: 'R040', x1:1425, y1:  0, x2:1585, y2: 313, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },

  // Thang bộ góc Đông-Nam ──────────────────────────────────────────────────
  { id_suffix: 'R041', x1:1582, y1:1780, x2:1746, y2:2096, name: 'Cầu thang Đông-Nam', type: 'stairs', accessible: false },
  { id_suffix: 'R042', x1:1425, y1:1780, x2:1582, y2:2096, name: 'Phòng chưa đặt tên', type: 'other', accessible: true, unlabeled: true },
];

// ─── Nút hành lang (px) ──────────────────────────────────────────────────────
// Tọa độ trục hành lang chính (dùng để dựng đồ thị)
// Các junction quan trọng để A* có thể đi qua
const CORRIDOR_NODES_PX = [
  // Hành lang Bắc (y≈375)
  { id: 'N001', x: 413,  z: 375, kind: 'junction' },  // Giao Bắc-Tây
  { id: 'N002', x: 657,  z: 375, kind: 'junction' },
  { id: 'N003', x: 816,  z: 375, kind: 'junction' },
  { id: 'N004', x: 977,  z: 375, kind: 'junction' },
  { id: 'N005', x:1135,  z: 375, kind: 'junction' },
  { id: 'N006', x:1295,  z: 375, kind: 'junction' },
  { id: 'N007', x:1365,  z: 375, kind: 'junction' },  // Giao Bắc-Đông

  // Hành lang Đông (x≈1365) - từ Bắc xuống Nam
  { id: 'N008', x:1365,  z: 443, kind: 'corridor' },
  { id: 'N009', x:1365,  z: 599, kind: 'corridor' },
  { id: 'N010', x:1365,  z: 747, kind: 'corridor' },
  { id: 'N011', x:1365,  z: 790, kind: 'junction' },  // Giao Đông-Giữa1
  { id: 'N012', x:1365,  z: 900, kind: 'corridor' },
  { id: 'N013', x:1365,  z:1042, kind: 'corridor' },
  { id: 'N014', x:1365,  z:1197, kind: 'corridor' },
  { id: 'N015', x:1365,  z:1285, kind: 'junction' },  // Giao Đông-Giữa2
  { id: 'N016', x:1365,  z:1347, kind: 'corridor' },
  { id: 'N017', x:1365,  z:1497, kind: 'corridor' },
  { id: 'N018', x:1365,  z:1695, kind: 'corridor' },
  { id: 'N019', x:1365,  z:2060, kind: 'junction' },  // Điểm vào (Cần xác nhận)

  // Hành lang giữa 1 (y≈790)
  { id: 'N020', x:1135,  z: 790, kind: 'junction' },
  { id: 'N021', x: 948,  z: 790, kind: 'junction' },  // Ngang thang bộ giữa
  { id: 'N022', x: 820,  z: 790, kind: 'corridor' },
  { id: 'N023', x: 657,  z: 790, kind: 'corridor' },
  { id: 'N024', x: 500,  z: 790, kind: 'junction' },
  { id: 'N025', x: 413,  z: 790, kind: 'junction' },  // Giao Giữa1-Tây

  // Hành lang giữa 2 (y≈1285)
  { id: 'N026', x:1135,  z:1285, kind: 'junction' },
  { id: 'N027', x: 982,  z:1285, kind: 'corridor' },
  { id: 'N028', x: 822,  z:1285, kind: 'corridor' },
  { id: 'N029', x: 662,  z:1285, kind: 'corridor' },
  { id: 'N030', x: 500,  z:1285, kind: 'junction' },
  { id: 'N031', x: 413,  z:1285, kind: 'junction' },  // Giao Giữa2-Tây

  // Hành lang Tây (x≈413)
  { id: 'N032', x: 413,  z:1497, kind: 'corridor' },
  { id: 'N033', x: 413,  z:1695, kind: 'junction' },  // Giao Tây-Nam
  { id: 'N034', x: 200,  z:1695, kind: 'corridor' },
  { id: 'N035', x:  20,  z:1695, kind: 'corridor' },

  // Thang máy nút (giữa khối)
  { id: 'N036', x:1135,  z:1028, kind: 'elev_door' },

  // Cầu thang giữa nút (STAIR_B)
  { id: 'N037', x: 722,  z:1028, kind: 'stair_end' },

  // Cầu thang Đông-Bắc nút (STAIR_A)
  { id: 'N038', x:1620,  z: 157, kind: 'stair_end' },
  // Cầu thang Đông-Nam nút (STAIR_C)
  { id: 'N039', x:1660,  z:1938, kind: 'stair_end' },

  // Điểm nối hành lang Đông ↔ thang Đông-Bắc
  { id: 'N040', x:1365,  z:  80, kind: 'junction' },
  // Điểm nối hành lang Đông ↔ thang Đông-Nam
  { id: 'N041', x:1365,  z:1780, kind: 'junction' },
];

// ─── Cửa phòng: nút trên hành lang gần nhất ─────────────────────────────────
// door_node_id: nút hành lang gần nhất; nếu cần nút mới thì tạo thêm
function makeDoorNodeId(floorN, idx) {
  return `F${floorN}_N${String(idx).padStart(3,'0')}`;
}

// Map room suffix → door position (px) & nearest corridor node
// door_px: vị trí cửa trên hành lang; corridor_node: ID nút hành lang gần nhất
const DOOR_MAP = {
  'R001': { door: { x: 169, z: 375 }, corridor_ref: 'N001' },
  'R002': { door: { x: 414, z: 375 }, corridor_ref: 'N001' },
  'R003': { door: { x: 573, z: 375 }, corridor_ref: 'N002' },
  'R004': { door: { x: 736, z: 375 }, corridor_ref: 'N003' },
  'R005': { door: { x: 896, z: 375 }, corridor_ref: 'N003' },
  'R006': { door: { x:1056, z: 375 }, corridor_ref: 'N005' },
  'R007': { door: { x:1215, z: 375 }, corridor_ref: 'N006' },
  'R008': { door: { x:1215, z: 375 }, corridor_ref: 'N006' },
  'R009': { door: { x: 737, z: 790 }, corridor_ref: 'N022' },
  'R010': { door: { x:1135, z: 790 }, corridor_ref: 'N020' },
  'R011': { door: { x: 413, z: 790 }, corridor_ref: 'N025' },
  'R012': { door: { x: 722, z: 790 }, corridor_ref: 'N021' },
  'R013': { door: { x:1135, z:1028 }, corridor_ref: 'N036' },
  'R014': { door: { x: 581, z:1285 }, corridor_ref: 'N029' },
  'R015': { door: { x: 742, z:1285 }, corridor_ref: 'N028' },
  'R016': { door: { x: 902, z:1285 }, corridor_ref: 'N027' },
  'R017': { door: { x:1059, z:1285 }, corridor_ref: 'N027' },
  'R018': { door: { x:1214, z:1285 }, corridor_ref: 'N026' },
  'R019': { door: { x: 580, z:1285 }, corridor_ref: 'N029' },
  'R020': { door: { x: 739, z:1285 }, corridor_ref: 'N028' },
  'R021': { door: { x: 895, z:1285 }, corridor_ref: 'N027' },
  'R022': { door: { x:1054, z:1285 }, corridor_ref: 'N027' },
  'R023': { door: { x:1214, z:1285 }, corridor_ref: 'N026' },
  'R024': { door: { x:1214, z:1285 }, corridor_ref: 'N026' },
  'R025': { door: { x:1214, z:1285 }, corridor_ref: 'N026' },
  'R026': { door: { x:1214, z:1285 }, corridor_ref: 'N026' },
  'R027': { door: { x: 172, z:1695 }, corridor_ref: 'N034' },
  'R028': { door: { x: 413, z:1695 }, corridor_ref: 'N033' },
  'R029': { door: { x: 172, z:1695 }, corridor_ref: 'N034' },
  'R030': { door: { x:1365, z: 375 }, corridor_ref: 'N007' },
  'R031': { door: { x:1365, z: 521 }, corridor_ref: 'N008' },
  'R032': { door: { x:1365, z: 673 }, corridor_ref: 'N009' },
  'R033': { door: { x:1365, z: 823 }, corridor_ref: 'N012' },
  'R034': { door: { x:1365, z: 971 }, corridor_ref: 'N012' },
  'R035': { door: { x:1365, z:1120 }, corridor_ref: 'N014' },
  'R036': { door: { x:1365, z:1272 }, corridor_ref: 'N014' },
  'R037': { door: { x:1365, z:1422 }, corridor_ref: 'N016' },
  'R038': { door: { x:1365, z:1638 }, corridor_ref: 'N018' },
  'R039': { door: { x:1365, z:  80 }, corridor_ref: 'N040' },
  'R040': { door: { x:1365, z:  80 }, corridor_ref: 'N040' },
  'R041': { door: { x:1365, z:1780 }, corridor_ref: 'N041' },
  'R042': { door: { x:1365, z:1780 }, corridor_ref: 'N041' },
};

// ─── Hàm tiện ích ─────────────────────────────────────────────────────────────
function normalizeVietnamese(str) {
  if (!str) return '';
  return str.normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ').trim();
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// ─── Build dữ liệu ─────────────────────────────────────────────────────────────
function buildAll() {
  const NUM_FLOORS = COORD.TOTAL_FLOORS;
  const FH = COORD.FLOOR_HEIGHT_M;

  // coordinate_system
  const coordinateSystem = {
    note: 'Cần xác nhận: tất cả giá trị bên dưới',
    M_PER_PX: COORD.M_PER_PX,
    IMG_W_PX: COORD.IMG_W_PX,
    IMG_H_PX: COORD.IMG_H_PX,
    FLOOR_HEIGHT_M: COORD.FLOOR_HEIGHT_M,
    WALL_HEIGHT_M: COORD.WALL_HEIGHT_M,
    WALL_THICKNESS_M: COORD.WALL_THICKNESS_M,
    TOTAL_FLOORS: NUM_FLOORS,
    origin: { x: 0, y: 0, z: 0 },
    northAngleDeg: 0,
    unit: 'm',
    axisX: 'east',
    axisZ: 'south',
    axisY: 'up',
    building_width_m: px(COORD.IMG_W_PX),
    building_depth_m: px(COORD.IMG_H_PX),
  };

  const floors = [];
  const rooms = [];
  const nodes = [];
  const edges = [];
  const connectors = [];
  const beacons = [];

  const nodeIndex = {}; // floorN_corridorRefId → actual nodeId

  for (let f = 1; f <= NUM_FLOORS; f++) {
    const floorId = `F${f}`;
    const elevation = (f - 1) * FH;

    floors.push({
      id: floorId,
      buildingId: 'B1',
      level: f,
      name: `Tầng ${f}`,
      elevation_m: +elevation.toFixed(2),
      height_m: FH,
      note: f === 1 ? 'Tầng trệt' : '',
    });

    // --- Nút hành lang cho tầng này ---
    const floorNodeIds = {};
    for (const cn of CORRIDOR_NODES_PX) {
      const nodeId = `${floorId}_${cn.id}`;
      floorNodeIds[cn.id] = nodeId;
      nodeIndex[`${f}_${cn.id}`] = nodeId;
      nodes.push({
        id: nodeId,
        floorId,
        x: +px(cn.x).toFixed(3),
        z: +px(cn.z).toFixed(3),
        y: +elevation.toFixed(2),
        kind: cn.kind,
      });
    }

    let roomSeq = 1;
    for (const rt of ROOM_TEMPLATE) {
      const roomId = `${floorId}_${rt.id_suffix}`;
      const cx = px((rt.x1 + rt.x2) / 2);
      const cz = px((rt.y1 + rt.y2) / 2);

      // Tạo nút cửa
      const dm = DOOR_MAP[rt.id_suffix];
      const doorNodeId = `${floorId}_D${rt.id_suffix.slice(1)}`;
      const doorX = dm ? +px(dm.door.x).toFixed(3) : +cx.toFixed(3);
      const doorZ = dm ? +px(dm.door.z).toFixed(3) : +cz.toFixed(3);

      nodes.push({
        id: doorNodeId,
        floorId,
        x: doorX,
        z: doorZ,
        y: +elevation.toFixed(2),
        kind: 'door',
      });

      // Cạnh nối cửa ↔ hành lang gần nhất
      if (dm && floorNodeIds[dm.corridor_ref]) {
        const corridorNodeId = floorNodeIds[dm.corridor_ref];
        const edgeId = `${floorId}_ED${rt.id_suffix.slice(1)}`;
        const cNode = CORRIDOR_NODES_PX.find(n => n.id === dm.corridor_ref);
        const len = cNode
          ? +Math.hypot(px(cNode.x) - doorX, px(cNode.z) - doorZ).toFixed(3)
          : 1.0;
        edges.push({
          id: edgeId,
          floorId,
          from: doorNodeId,
          to: corridorNodeId,
          length_m: len,
          weight: len,
          bidirectional: true,
          wheelchairOk: rt.type !== 'stairs',
          type: rt.type === 'stairs' ? 'stairs' : 'walk',
          restricted: false,
          widthMin_m: 1.4,
        });
      }

      const displayName = rt.unlabeled
        ? `Phòng chưa đặt tên F${f}-${roomSeq}`
        : rt.name;

      rooms.push({
        id: roomId,
        floorId,
        name: displayName,
        nameAscii: normalizeVietnamese(displayName),
        type: rt.type,
        accessible: rt.accessible,
        doorNodeId,
        centroid: { x: +cx.toFixed(3), z: +cz.toFixed(3) },
        bounds: {
          x1: +px(rt.x1).toFixed(3), z1: +px(rt.y1).toFixed(3),
          x2: +px(rt.x2).toFixed(3), z2: +px(rt.y2).toFixed(3),
        },
        aliases: [],
        unlabeled: !!rt.unlabeled,
        status: 'active',
      });

      roomSeq++;
    }

    // --- Cạnh hành lang (nối các nút corridor) ---
    const corridorEdges = [
      // Hành lang Bắc
      ['N001','N002'], ['N002','N003'], ['N003','N004'], ['N004','N005'],
      ['N005','N006'], ['N006','N007'],
      // Hành lang Đông (N007→N040→N008→N009→N010→N011→N012→N013→N014→N015→N016→N017→N018→N041→N019)
      ['N040','N007'], ['N007','N008'], ['N008','N009'], ['N009','N010'],
      ['N010','N011'], ['N011','N012'], ['N012','N013'], ['N013','N014'],
      ['N014','N015'], ['N015','N016'], ['N016','N017'], ['N017','N018'],
      ['N018','N041'], ['N041','N019'],
      // Hành lang Tây
      ['N001','N025'], ['N025','N031'], ['N031','N033'], ['N033','N035'],
      ['N034','N033'], ['N035','N034'],
      // Hành lang giữa 1
      ['N011','N020'], ['N020','N021'], ['N021','N022'], ['N022','N023'],
      ['N023','N024'], ['N024','N025'],
      // Hành lang giữa 2
      ['N015','N026'], ['N026','N027'], ['N027','N028'], ['N028','N029'],
      ['N029','N030'], ['N030','N031'],
      // Thang máy → hành lang giữa 1
      ['N036','N020'],
      // Thang bộ giữa → hành lang giữa 1
      ['N037','N021'],
    ];

    let eSeq = 1;
    for (const [a, b] of corridorEdges) {
      if (!floorNodeIds[a] || !floorNodeIds[b]) continue;
      const na = CORRIDOR_NODES_PX.find(n => n.id === a);
      const nb = CORRIDOR_NODES_PX.find(n => n.id === b);
      const len = na && nb
        ? +Math.hypot(px(na.x)-px(nb.x), px(na.z)-px(nb.z)).toFixed(3)
        : 1.0;
      edges.push({
        id: `${floorId}_E${String(eSeq++).padStart(3,'0')}`,
        floorId,
        from: floorNodeIds[a],
        to: floorNodeIds[b],
        length_m: len,
        weight: len,
        bidirectional: true,
        wheelchairOk: true,
        type: 'walk',
        restricted: false,
        widthMin_m: 1.6,
      });
    }

    // --- Beacon mô phỏng (planned, UUID placeholder) ---
    const beaconPositions = [
      { id: `${floorId}_B01`, x: px(413),  z: px(375)  },
      { id: `${floorId}_B02`, x: px(1365), z: px(790)  },
      { id: `${floorId}_B03`, x: px(1365), z: px(1285) },
      { id: `${floorId}_B04`, x: px(413),  z: px(1285) },
      { id: `${floorId}_B05`, x: px(1135), z: px(1028) },
    ];
    for (const bp of beaconPositions) {
      beacons.push({
        id: bp.id,
        floorId,
        x: +bp.x.toFixed(3),
        z: +bp.z.toFixed(3),
        y: +(elevation + 2.5).toFixed(2),
        height_m: 2.5,
        protocol: 'iBeacon',
        uuid: 'SIMULATED',
        major: f,
        minor: parseInt(bp.id.slice(-2)),
        txPower_dBm: null,
        rssiAt1m: null,
        batteryPct: null,
        installedAt: null,
        status: 'planned',
        note: 'UUID placeholder – không phải UUID thật',
      });
    }
  }

  // ─── Connectors (liên tầng) ─────────────────────────────────────────────────
  // STAIR_A: Cầu thang Đông-Bắc
  const stairA = {
    id: 'STAIR_A',
    type: 'stairs',
    wheelchairOk: false,
    restricted: false,
    name: 'Cầu thang Đông-Bắc',
    links: [],
  };
  // STAIR_B: Cầu thang giữa
  const stairB = {
    id: 'STAIR_B',
    type: 'stairs',
    wheelchairOk: false,
    restricted: false,
    name: 'Cầu thang giữa',
    links: [],
  };
  // STAIR_C: Cầu thang Đông-Nam
  const stairC = {
    id: 'STAIR_C',
    type: 'stairs',
    wheelchairOk: false,
    restricted: false,
    name: 'Cầu thang Đông-Nam',
    links: [],
  };
  // ELEV_A: Thang máy (Cần xác nhận: thang máy hay giếng trời)
  const elevA = {
    id: 'ELEV_A',
    type: 'elevator',
    wheelchairOk: true,
    restricted: false,
    name: 'Thang máy A (Cần xác nhận)',
    waitTime_s: 30,
    links: [],
  };

  for (let f = 1; f <= NUM_FLOORS; f++) {
    const floorId = `F${f}`;
    stairA.links.push({ floorId, nodeId: `${floorId}_N038` });
    stairB.links.push({ floorId, nodeId: `${floorId}_N037` });
    stairC.links.push({ floorId, nodeId: `${floorId}_N039` });
    elevA.links.push({ floorId, nodeId: `${floorId}_N036` });
  }

  connectors.push(stairA, stairB, stairC, elevA);

  // ─── Cạnh liên tầng (connector edges) ────────────────────────────────────────
  for (const conn of connectors) {
    for (let i = 0; i < conn.links.length - 1; i++) {
      const a = conn.links[i];
      const b = conn.links[i + 1];
      const flA = parseInt(a.floorId.slice(1));
      const flB = parseInt(b.floorId.slice(1));
      const vertDist = Math.abs(flB - flA) * COORD.FLOOR_HEIGHT_M;
      const baseWeight = conn.type === 'elevator'
        ? vertDist + (conn.waitTime_s || 30)
        : vertDist * 2.5;
      edges.push({
        id: `${conn.id}_E${i+1}`,
        floorId: `MULTI_${a.floorId}_${b.floorId}`,
        connectorId: conn.id,
        from: a.nodeId,
        to: b.nodeId,
        length_m: +vertDist.toFixed(2),
        weight: +baseWeight.toFixed(2),
        bidirectional: true,
        wheelchairOk: conn.wheelchairOk,
        type: conn.type,
        restricted: conn.restricted,
        widthMin_m: conn.type === 'elevator' ? 1.1 : 1.2,
      });
    }
  }

  // ─── Floor template JSON ──────────────────────────────────────────────────────
  const floorTemplate = {
    note: 'Cần xác nhận: mặt bằng điển hình áp dụng cho F1–F9. Mỗi tầng có thể ghi đè.',
    M_PER_PX: COORD.M_PER_PX,
    rooms: ROOM_TEMPLATE.map(rt => ({
      id_suffix: rt.id_suffix,
      bounds_px: { x1: rt.x1, y1: rt.y1, x2: rt.x2, y2: rt.y2 },
      bounds_m: {
        x1: +px(rt.x1).toFixed(3), z1: +px(rt.y1).toFixed(3),
        x2: +px(rt.x2).toFixed(3), z2: +px(rt.y2).toFixed(3),
      },
      name: rt.name,
      type: rt.type,
      accessible: rt.accessible,
      unlabeled: !!rt.unlabeled,
    })),
    corridor_nodes: CORRIDOR_NODES_PX.map(cn => ({
      id: cn.id,
      x_px: cn.x, z_px: cn.z,
      x_m: +px(cn.x).toFixed(3), z_m: +px(cn.z).toFixed(3),
      kind: cn.kind,
    })),
  };

  // ─── manifest ─────────────────────────────────────────────────────────────────
  const dataFiles = { floors, rooms, nodes, edges, connectors, beacons };
  const hashes = {};
  for (const [k, v] of Object.entries(dataFiles)) {
    hashes[k] = createHash('sha256')
      .update(JSON.stringify(v))
      .digest('hex')
      .slice(0, 16);
  }

  const manifest = {
    version: '0.1.0-prototype',
    generatedAt: new Date().toISOString(),
    buildingId: 'B1',
    buildingName: 'Bệnh viện Quân y 7A',
    note: 'Prototype P0.5 – dữ liệu giả định, chưa xác minh thực tế',
    hashes,
  };

  return { coordinateSystem, floorTemplate, floors, rooms, nodes, edges, connectors, beacons, manifest };
}

// ─── Ghi file ─────────────────────────────────────────────────────────────────
function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  const size = fs.statSync(filePath).size;
  console.log(`  ✓ ${path.relative(ROOT, filePath)} (${(size/1024).toFixed(1)} KB)`);
}

const data = buildAll();

console.log('Generating data files...');
writeJSON(path.join(DATA_DIR, 'coordinate_system.json'), data.coordinateSystem);
writeJSON(path.join(DATA_DIR, 'floor_template.json'),   data.floorTemplate);
writeJSON(path.join(DATA_DIR, 'floors.json'),            data.floors);
writeJSON(path.join(DATA_DIR, 'rooms.json'),             data.rooms);
writeJSON(path.join(DATA_DIR, 'nodes.json'),             data.nodes);
writeJSON(path.join(DATA_DIR, 'edges.json'),             data.edges);
writeJSON(path.join(DATA_DIR, 'connectors.json'),        data.connectors);
writeJSON(path.join(DATA_DIR, 'beacons.json'),           data.beacons);
writeJSON(path.join(DATA_DIR, 'manifest.json'),          data.manifest);

console.log(`\nSummary:`);
console.log(`  Floors:     ${data.floors.length}`);
console.log(`  Rooms:      ${data.rooms.length}`);
console.log(`  Nodes:      ${data.nodes.length}`);
console.log(`  Edges:      ${data.edges.length}`);
console.log(`  Connectors: ${data.connectors.length}`);
console.log(`  Beacons:    ${data.beacons.length}`);
console.log('\nDone.');
