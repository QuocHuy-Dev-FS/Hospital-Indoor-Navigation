/**
 * sampleModel.js — Dữ liệu mẫu hardcoded.
 * Dùng khi data/*.json không tải được (server chưa chạy, file thiếu, v.v.).
 * Format khớp chính xác với data thật để loadAll() tiếp tục bình thường.
 * Khi có data thật, module này không được dùng.
 */

export const SAMPLE_DATA = {
  coordSys: {
    building_width_m: 30,
    building_depth_m: 20,
    FLOOR_HEIGHT_M: 3.6,
    WALL_HEIGHT_M: 3.0,
    WALL_THICKNESS_M: 0.2,
    M_PER_PX: 0.02,
    TOTAL_FLOORS: 2,
    origin: { x: 0, y: 0, z: 0 },
    northAngleDeg: 0,
    unit: 'm',
    axisX: 'east',
    axisZ: 'south',
    axisY: 'up',
  },

  floors: [
    { id: 'F1', buildingId: 'B1', level: 1, name: 'Tầng 1', elevation_m: 0,   height_m: 3.6, note: 'Tầng trệt (mẫu)' },
    { id: 'F2', buildingId: 'B1', level: 2, name: 'Tầng 2', elevation_m: 3.6, height_m: 3.6, note: 'Tầng 2 (mẫu)' },
  ],

  rooms: [
    // Tầng 1
    {
      id: 'F1_R001', floorId: 'F1', name: 'Sảnh chính', type: 'entrance',
      accessible: true, doorNodeId: 'F1_D001', unlabeled: false,
      bounds: { x1: 0, z1: 0, x2: 12, z2: 5 },
      centroid: { x: 6, z: 2.5 }, aliases: [], status: 'active',
    },
    {
      id: 'F1_R002', floorId: 'F1', name: 'Phòng khám tổng hợp', type: 'clinic',
      accessible: true, doorNodeId: 'F1_D002', unlabeled: false,
      bounds: { x1: 0, z1: 5, x2: 7, z2: 13 },
      centroid: { x: 3.5, z: 9 }, aliases: [], status: 'active',
    },
    {
      id: 'F1_R003', floorId: 'F1', name: 'Phòng xét nghiệm', type: 'lab',
      accessible: true, doorNodeId: 'F1_D003', unlabeled: false,
      bounds: { x1: 7, z1: 5, x2: 14, z2: 13 },
      centroid: { x: 10.5, z: 9 }, aliases: [], status: 'active',
    },
    {
      id: 'F1_R004', floorId: 'F1', name: 'WC', type: 'wc',
      accessible: true, doorNodeId: 'F1_D004', unlabeled: false,
      bounds: { x1: 14, z1: 5, x2: 18, z2: 10 },
      centroid: { x: 16, z: 7.5 }, aliases: [], status: 'active',
    },
    {
      id: 'F1_R005', floorId: 'F1', name: 'Thang máy', type: 'elevator',
      accessible: true, doorNodeId: 'F1_D005', unlabeled: false,
      bounds: { x1: 12, z1: 0, x2: 16, z2: 5 },
      centroid: { x: 14, z: 2.5 }, aliases: [], status: 'active',
    },
    {
      id: 'F1_R006', floorId: 'F1', name: 'Thu ngân', type: 'cashier',
      accessible: true, doorNodeId: 'F1_D006', unlabeled: false,
      bounds: { x1: 16, z1: 0, x2: 24, z2: 5 },
      centroid: { x: 20, z: 2.5 }, aliases: [], status: 'active',
    },
    {
      id: 'F1_R007', floorId: 'F1', name: 'Nhà thuốc', type: 'pharmacy',
      accessible: true, doorNodeId: 'F1_D007', unlabeled: false,
      bounds: { x1: 14, z1: 10, x2: 24, z2: 15 },
      centroid: { x: 19, z: 12.5 }, aliases: [], status: 'active',
    },
    {
      id: 'F1_R008', floorId: 'F1', name: 'Hành lang', type: 'other',
      accessible: true, doorNodeId: 'F1_D008', unlabeled: false,
      bounds: { x1: 0, z1: 13, x2: 24, z2: 17 },
      centroid: { x: 12, z: 15 }, aliases: [], status: 'active',
    },
    // Tầng 2
    {
      id: 'F2_R001', floorId: 'F2', name: 'Phòng khám chuyên khoa', type: 'clinic',
      accessible: true, doorNodeId: 'F2_D001', unlabeled: false,
      bounds: { x1: 0, z1: 0, x2: 10, z2: 9 },
      centroid: { x: 5, z: 4.5 }, aliases: [], status: 'active',
    },
    {
      id: 'F2_R002', floorId: 'F2', name: 'Phòng X-Quang', type: 'xray',
      accessible: true, doorNodeId: 'F2_D002', unlabeled: false,
      bounds: { x1: 10, z1: 0, x2: 20, z2: 9 },
      centroid: { x: 15, z: 4.5 }, aliases: [], status: 'active',
    },
    {
      id: 'F2_R003', floorId: 'F2', name: 'Hành lang tầng 2', type: 'other',
      accessible: true, doorNodeId: 'F2_D003', unlabeled: false,
      bounds: { x1: 0, z1: 9, x2: 24, z2: 13 },
      centroid: { x: 12, z: 11 }, aliases: [], status: 'active',
    },
  ],

  nodes: [
    { id: 'F1_D001', x: 6,    y: 0,   z: 4.8,  floorId: 'F1', type: 'door' },
    { id: 'F1_D002', x: 3.5,  y: 0,   z: 5.2,  floorId: 'F1', type: 'door' },
    { id: 'F1_D003', x: 10.5, y: 0,   z: 5.2,  floorId: 'F1', type: 'door' },
    { id: 'F1_D004', x: 14,   y: 0,   z: 5.2,  floorId: 'F1', type: 'door' },
    { id: 'F1_D005', x: 14,   y: 0,   z: 4.8,  floorId: 'F1', type: 'door' },
    { id: 'F1_D006', x: 20,   y: 0,   z: 4.8,  floorId: 'F1', type: 'door' },
    { id: 'F1_D007', x: 19,   y: 0,   z: 10.2, floorId: 'F1', type: 'door' },
    { id: 'F1_D008', x: 12,   y: 0,   z: 13.2, floorId: 'F1', type: 'door' },
    { id: 'F1_N001', x: 12,   y: 0,   z: 7,    floorId: 'F1', type: 'junction' },
    { id: 'F2_D001', x: 5,    y: 3.6, z: 8.8,  floorId: 'F2', type: 'door' },
    { id: 'F2_D002', x: 15,   y: 3.6, z: 8.8,  floorId: 'F2', type: 'door' },
    { id: 'F2_D003', x: 12,   y: 3.6, z: 9.2,  floorId: 'F2', type: 'door' },
    { id: 'F2_N001', x: 12,   y: 3.6, z: 11,   floorId: 'F2', type: 'junction' },
  ],

  edges: [
    { id: 'F1_E001', from: 'F1_D001', to: 'F1_N001', weight: 6.2,  bidirectional: true, wheelchairOk: true,  type: 'walk' },
    { id: 'F1_E002', from: 'F1_D002', to: 'F1_N001', weight: 8.6,  bidirectional: true, wheelchairOk: true,  type: 'walk' },
    { id: 'F1_E003', from: 'F1_D003', to: 'F1_N001', weight: 1.5,  bidirectional: true, wheelchairOk: true,  type: 'walk' },
    { id: 'F1_E004', from: 'F1_D004', to: 'F1_N001', weight: 2.0,  bidirectional: true, wheelchairOk: true,  type: 'walk' },
    { id: 'F1_E005', from: 'F1_D005', to: 'F1_N001', weight: 2.0,  bidirectional: true, wheelchairOk: true,  type: 'elevator' },
    { id: 'F1_E006', from: 'F1_D006', to: 'F1_N001', weight: 8.0,  bidirectional: true, wheelchairOk: true,  type: 'walk' },
    { id: 'F1_E007', from: 'F1_D007', to: 'F1_N001', weight: 7.5,  bidirectional: true, wheelchairOk: true,  type: 'walk' },
    { id: 'F1_E008', from: 'F1_D008', to: 'F1_N001', weight: 6.0,  bidirectional: true, wheelchairOk: true,  type: 'walk' },
    { id: 'F2_E001', from: 'F2_D001', to: 'F2_N001', weight: 6.5,  bidirectional: true, wheelchairOk: true,  type: 'walk' },
    { id: 'F2_E002', from: 'F2_D002', to: 'F2_N001', weight: 3.0,  bidirectional: true, wheelchairOk: true,  type: 'walk' },
    { id: 'F2_E003', from: 'F2_D003', to: 'F2_N001', weight: 1.8,  bidirectional: true, wheelchairOk: true,  type: 'walk' },
    // Kết nối thang máy F1 ↔ F2
    { id: 'ELV_01',  from: 'F1_D005', to: 'F2_D003', weight: 3.6,  bidirectional: true, wheelchairOk: true,  type: 'elevator' },
  ],

  connectors: [],
  beacons: [],

  manifest: {
    version: 'sample-1.0',
    generated: '2026-10-26T00:00:00.000Z',
    note: 'Dữ liệu mẫu — không phải sơ đồ thật BV Quân y 7A',
  },
};
