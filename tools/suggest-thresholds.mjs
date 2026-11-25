/**
 * suggest-thresholds.mjs — Đề xuất tham số RoomResolver từ CSV đo RSSI.
 *
 * Chạy: node tools/suggest-thresholds.mjs bench/measurements/<file>.csv
 *
 * QUAN TRỌNG:
 *  - Script chỉ IN ĐỀ XUẤT ra stdout, KHÔNG tự ghi đè bench/room-resolver.js.
 *  - Chủ dự án xem xét và cập nhật DEFAULT_PARAMS thủ công.
 *  - Kết quả chỉ có ý nghĩa khi có ≥10 mẫu mỗi mốc khoảng cách.
 *
 * Định dạng CSV đầu vào (header bắt buộc):
 *   beaconRef,distance_m,condition,sampleIndex,rssi_dBm,timestamp,notes
 */

import { readFileSync } from 'node:fs';

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Dùng: node tools/suggest-thresholds.mjs <path-to-csv>');
  process.exit(1);
}

let raw;
try {
  raw = readFileSync(csvPath, 'utf8');
} catch (e) {
  console.error('Không đọc được file:', e.message);
  process.exit(1);
}

// ─── Parse CSV ────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = splitCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (cols[i] ?? '').trim(); });
    return row;
  }).filter(r => r.rssi_dBm !== '' && r.rssi_dBm !== undefined);
}

function splitCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { result.push(cur); cur = ''; continue; }
    cur += c;
  }
  result.push(cur);
  return result;
}

const rows = parseCSV(raw);
if (rows.length === 0) {
  console.error('Không có dữ liệu hợp lệ trong CSV.');
  process.exit(1);
}

// ─── Nhóm theo khoảng cách ────────────────────────────────────────────────────

const byDist = new Map();
for (const r of rows) {
  const d = parseFloat(r.distance_m);
  if (isNaN(d)) continue;
  const rssi = parseFloat(r.rssi_dBm);
  if (isNaN(rssi)) continue;
  if (!byDist.has(d)) byDist.set(d, []);
  byDist.get(d).push(rssi);
}

if (byDist.size === 0) {
  console.error('Không có hàng nào có distance_m và rssi_dBm hợp lệ.');
  process.exit(1);
}

// ─── Thống kê ─────────────────────────────────────────────────────────────────

function stats(arr) {
  const n = arr.length;
  const sorted = [...arr].sort((a, b) => a - b);
  const mean = arr.reduce((s, v) => s + v, 0) / n;
  const std  = Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  const p5   = sorted[Math.max(0, Math.floor(n * 0.05))];
  const p95  = sorted[Math.min(n - 1, Math.ceil(n * 0.95) - 1)];
  return { n, mean: +mean.toFixed(1), std: +std.toFixed(1), min: sorted[0], max: sorted[n-1], p5, p95 };
}

// ─── In thống kê theo khoảng cách ────────────────────────────────────────────

const MIN_SAMPLES = 10;
const warnings = [];

console.log('\n=== Thống kê RSSI theo khoảng cách (dữ liệu: ' + csvPath + ') ===\n');
console.log('Khoảng cách (m) | n mẫu | Trung bình | σ     | Min   | Max   | P5    | P95');
console.log('----------------|-------|------------|-------|-------|-------|-------|------');

const sortedDists = [...byDist.keys()].sort((a, b) => a - b);
const statsByDist = new Map();

for (const d of sortedDists) {
  const arr = byDist.get(d);
  const s = stats(arr);
  statsByDist.set(d, s);
  const flag = s.n < MIN_SAMPLES ? ' ⚠' : '';
  console.log(
    String(d).padEnd(16) + '| ' +
    String(s.n).padEnd(6) + '| ' +
    String(s.mean).padEnd(11) + '| ' +
    String(s.std).padEnd(6) + '| ' +
    String(s.min).padEnd(6) + '| ' +
    String(s.max).padEnd(6) + '| ' +
    String(s.p5).padEnd(6) + '| ' + s.p95 + flag
  );
  if (s.n < MIN_SAMPLES) warnings.push(`⚠ Chỉ có ${s.n} mẫu ở ${d} m — khuyến nghị ≥${MIN_SAMPLES} để kết quả tin cậy`);
}

// ─── Tính đề xuất ngưỡng ─────────────────────────────────────────────────────

console.log('\n=== Đề xuất tham số RoomResolver ===\n');

// rssiThreshold = P5 của RSSI ở khoảng cách lớn nhất, làm tròn xuống bội 5
const maxDist = sortedDists[sortedDists.length - 1];
const maxDistStats = statsByDist.get(maxDist);
let rssiThreshold = null;
if (maxDistStats && maxDistStats.n >= MIN_SAMPLES) {
  rssiThreshold = Math.floor(maxDistStats.p5 / 5) * 5;
  console.log(`rssiThreshold:    ${rssiThreshold} dBm`);
  console.log(`  Công thức: P5 của RSSI tại ${maxDist} m = ${maxDistStats.p5} dBm → làm tròn xuống bội 5`);
} else {
  console.log(`rssiThreshold:    (chưa đủ dữ liệu tại khoảng cách lớn nhất ${maxDist} m)`);
}

// hysteresisMargin = 2×σ của RSSI tại 1 m, làm tròn lên 1 dBm, tối thiểu 3 dBm
const stats1m = statsByDist.get(1);
let hysteresisMargin = null;
if (stats1m && stats1m.n >= MIN_SAMPLES) {
  hysteresisMargin = Math.max(3, Math.ceil(2 * stats1m.std));
  console.log(`\nhysteresisMargin: ${hysteresisMargin} dBm`);
  console.log(`  Công thức: 2 × σ(1 m) = 2 × ${stats1m.std} = ${+(2 * stats1m.std).toFixed(1)} → làm tròn lên, tối thiểu 3`);
} else {
  console.log(`\nhysteresisMargin: (chưa đủ dữ liệu tại 1 m)`);
}

console.log('\nwindowSize:       5       (giữ mặc định — chỉnh khi có dữ liệu bổ sung)');
console.log('sampleTTL_ms:     10000   (giữ mặc định — chỉnh nếu beacon phát chậm >2s)');
console.log('minConsecutive:   3       (giữ mặc định)');

// ─── Cảnh báo ─────────────────────────────────────────────────────────────────

if (warnings.length > 0) {
  console.log('\n--- Cảnh báo ---');
  warnings.forEach(w => console.log(w));
}

console.log('\n--- QUAN TRỌNG ---');
console.log('Đây là ĐỀ XUẤT — chưa áp dụng. Chủ dự án xem xét và cập nhật');
console.log('DEFAULT_PARAMS trong bench/room-resolver.js thủ công.\n');
