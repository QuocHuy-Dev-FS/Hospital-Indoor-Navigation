/**
 * beacon_sim.js — Mô phỏng định vị BLE (không dùng beacon thật)
 * Cảnh báo rõ: đây là simulation, không phải vị trí thật.
 */

const RSSI_AT_1M  = -65;   // dBm tham khảo
const PATH_LOSS_N = 2.5;   // hệ số suy hao (2–4 cho trong nhà)
const NOISE_STD   = 4;     // độ lệch chuẩn nhiễu RSSI (dBm)
const FILTER_WIN  = 5;     // cửa sổ trung bình trượt

function distToRSSI(dist) {
  if (dist < 0.1) dist = 0.1;
  return RSSI_AT_1M - 10 * PATH_LOSS_N * Math.log10(dist);
}

function gaussian(std) {
  // Box-Muller transform
  const u1 = Math.random(), u2 = Math.random();
  return std * Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
}

export class BeaconSimulator {
  constructor(beacons) {
    this._beacons = beacons;
    this._filters = new Map(); // beaconId → ring buffer
    this._simPos  = null;      // { x, y, z }
    this._lostSignal = false;
  }

  setSimulatedPosition(x, y, z) {
    this._simPos = { x, y, z };
    this._lostSignal = false;
  }

  simulateLostSignal() {
    this._lostSignal = true;
  }

  restoreSignal() {
    this._lostSignal = false;
  }

  isSignalLost() { return this._lostSignal; }

  // Trả về danh sách { beaconId, rssi, filtered_rssi }
  scanBeacons(floorId) {
    if (this._lostSignal || !this._simPos) return [];
    const pos = this._simPos;
    const floorBeacons = this._beacons.filter(b => b.floorId === floorId);
    const results = [];

    for (const b of floorBeacons) {
      const dist3d = Math.hypot(b.x - pos.x, (b.y ?? 0) - pos.y, b.z - pos.z);
      const raw = distToRSSI(dist3d) + gaussian(NOISE_STD);

      // Trung bình trượt
      if (!this._filters.has(b.id)) this._filters.set(b.id, []);
      const buf = this._filters.get(b.id);
      buf.push(raw);
      if (buf.length > FILTER_WIN) buf.shift();
      const filtered = buf.reduce((a, v) => a + v, 0) / buf.length;

      results.push({ beaconId: b.id, rssi: +raw.toFixed(1), filtered: +filtered.toFixed(1), dist3d: +dist3d.toFixed(2) });
    }

    // Sắp xếp theo RSSI cao nhất (gần nhất)
    return results.sort((a, b) => b.filtered - a.filtered);
  }

  // Ước lượng vị trí từ beacon mạnh nhất (proximity)
  estimatePosition(floorId) {
    if (this._lostSignal || !this._simPos) return null;
    const scans = this.scanBeacons(floorId);
    if (scans.length === 0) return null;
    // Chọn beacon mạnh nhất → vị trí xấp xỉ là vị trí mô phỏng
    // (trong thực tế sẽ dùng trilateration)
    return {
      x: this._simPos.x,
      y: this._simPos.y,
      z: this._simPos.z,
      confidence: Math.min(1, scans[0].filtered > -80 ? 0.7 : 0.3),
      nearestBeacon: scans[0].beaconId,
      method: 'proximity_simulated',
      warning: 'Vị trí mô phỏng – chưa dùng beacon thật',
    };
  }
}
