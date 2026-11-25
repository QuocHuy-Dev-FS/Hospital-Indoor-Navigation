/**
 * Sinh file HTML liệt kê link ?at=<roomId> cho từng phòng.
 * Dùng để copy URL vào trang tạo QR code bên ngoài.
 *
 * Cách dùng:
 *   node tools/gen_qr_links.mjs
 *   node tools/gen_qr_links.mjs https://example.com
 *
 * Kết quả: tools/out/qr_links.html
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const ROOT   = join(__dir, '..');
const baseURL = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '');

const isProduction = baseURL.startsWith('https://');
if (!isProduction) {
  console.warn('[gen_qr_links] CẢNH BÁO: base URL chưa phải HTTPS.');
  console.warn('  requestLEScan yêu cầu HTTPS khi dùng trên Android thật.');
  console.warn('  QR code này chỉ dùng được trên localhost (kiểm thử nội bộ).');
  console.warn('  Khi triển khai, chạy lại: node tools/gen_qr_links.mjs https://<domain>');
}

let rooms;
try {
  rooms = JSON.parse(readFileSync(join(ROOT, 'data', 'rooms.json'), 'utf8'));
} catch (e) {
  console.error('[gen_qr_links] Không đọc được data/rooms.json:', e.message);
  process.exit(1);
}

// Nhóm theo tầng
const byFloor = {};
for (const r of rooms) {
  const floor = r.id?.split('_')[0] ?? 'Unknown';
  (byFloor[floor] = byFloor[floor] ?? []).push(r);
}

const floorBlocks = Object.entries(byFloor).sort(([a], [b]) => a.localeCompare(b)).map(([floor, list]) => {
  const rows = list.map(r => {
    const url = `${baseURL}/?at=${encodeURIComponent(r.id)}`;
    return `      <tr>
        <td>${r.id}</td>
        <td>${r.name ?? '—'}</td>
        <td>${r.type ?? '—'}</td>
        <td class="url-cell"><a href="${url}" target="_blank">${url}</a></td>
      </tr>`;
  }).join('\n');
  return `    <h2>${floor}</h2>
    <table>
      <thead><tr><th>ID phòng</th><th>Tên</th><th>Loại</th><th>URL (?at=)</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>`;
}).join('\n\n');

const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Danh sách link QR – Hospital Indoor Navigation</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 20px; color: #1a2a3a; }
    h1 { font-size: 1.3rem; color: #1565C0; }
    h2 { font-size: 1.05rem; color: #1565C0; margin-top: 24px; }
    .warn { background: #fff3e0; border: 1px solid #e65100; padding: 10px 14px; border-radius: 6px; margin-bottom: 18px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 10px; }
    th, td { border: 1px solid #d0dce8; padding: 6px 10px; font-size: 0.85rem; }
    th { background: #eef4fa; }
    .url-cell a { color: #1565C0; word-break: break-all; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>Danh sách link QR – Hospital Indoor Navigation</h1>
  <p class="no-print" style="font-size:0.85rem;color:#607080;">
    Sinh lúc ${new Date().toLocaleString('vi-VN')} · base URL: <code>${baseURL}</code>
  </p>
  ${!isProduction ? `<div class="warn">⚠️ URL chưa phải HTTPS — chỉ dùng được trên localhost (kiểm thử nội bộ).<br>
    Khi triển khai: chạy <code>node tools/gen_qr_links.mjs https://&lt;domain&gt;</code></div>` : ''}
  <p class="no-print" style="font-size:0.85rem;">
    Sao chép URL từng dòng vào trang tạo QR code (ví dụ: <em>qr-code-generator.com</em>) để in QR.<br>
    Mỗi QR khi quét sẽ mở app và đặt vị trí xuất phát vào phòng tương ứng.
  </p>

${floorBlocks}

  <p style="margin-top:24px;font-size:0.8rem;color:#607080;">${rooms.length} phòng tổng cộng</p>
</body>
</html>`;

const outDir = join(__dir, 'out');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'qr_links.html');
writeFileSync(outFile, html, 'utf8');
console.log(`[gen_qr_links] Đã ghi ${rooms.length} phòng → ${outFile}`);
