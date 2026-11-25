# Prompt chuẩn v2 (chờ duyệt Cổng 1) — Chế độ "Gán beacon" trên bản đồ 3D, lưu bằng dev server

Ngày: 2026-11-09 · Nhánh: master (chưa có commit) · Phase dự án: Chuẩn bị → chờ Phase 0 (không đổi)
Thay thế bản nháp `2026-11-09-beacon-placement-3d.md` (giữ nguyên, không ghi đè). Đã chốt: **lưu vị trí bằng dev server ghi file (P2)**. Gộp luôn hướng của `2026-11-09-beacon-map-plan-a-v2.md` (marker hiển thị).

## Mục tiêu
Beacon đã quyết (có UUID/Major/Minor) → mở bản đồ 3D, bật chế độ "Gán beacon", chọn beacon, chạm điểm trên đúng tầng, xác nhận. Vị trí được ghi thẳng vào `data/beacons.local.json` (gitignored), marker hiện ngay, không quét lại, không sửa tay JSON.

## Phạm vi
1. **Giao diện** (sidebar mục beacon, chỉ desktop, tắt ở `?kiosk`/mobile-flow): danh sách beacon theo id (F1_B01…, nhãn đã/chưa gán), chọn → chạm bản đồ (Raycaster, tham chiếu `src/main.js:302-337`) → xem trước marker → Xác nhận / Hủy / Gỡ vị trí / kéo chỉnh; `height_m` mặc định 2.5, sửa được. UUID không hiển thị, không log.
2. **Máy chủ dev** (`vite.config.js`, thêm route cùng kiểu `/api/loc/*`):
   - `GET /api/beacons/placements` → trả `[{id, floorId, x, z, height_m}]` (KHÔNG trả uuid).
   - `POST /api/beacons/placement` body `{id, floorId, x, z, height_m}` hoặc `{id, remove:true}`.
   - Ràng buộc bảo mật: chỉ chấp nhận khi `remoteAddress` là loopback (`_isLocalhost` đã có) — bắt buộc vì `npm run dev:lan` chạy `--host 0.0.0.0`; kiểm `Host`/`Origin` là localhost; không đặt CORS `*`; giới hạn kích thước body; chỉ ghi vào đúng một đường dẫn cố định `data/beacons.local.json`; chỉ cập nhật bản ghi có sẵn theo `id` và chỉ sửa các trường `floorId, x, z, height_m` (client không bao giờ gửi hay nhận UUID/Major/Minor, server giữ nguyên các trường khác); validate số hữu hạn, trong khung tầng, `id` có trong file; ghi nguyên tử (file tạm rồi đổi tên) và sao lưu một lần `beacons.local.json.bak-<ngày>` trước lần ghi đầu của phiên.
   - Nếu `data/beacons.local.json` chưa tồn tại → trả lỗi rõ ràng, không tự tạo (không bịa UUID).
3. **Mô-đun thuần + test**: `src/positioning/beacon_placement.js` (validate điểm, khung tầng, tầng có trong cảnh, ghi đè/gỡ, serialize không chứa uuid), logic xử lý yêu cầu của route tách thành hàm thuần để test trong Node (ví dụ `tools/` hoặc `src/positioning/`, executor chọn nơi ít xâm lấn), `tests/beacon_placement.test.mjs` và thêm tên file vào script `test` (chỉ thêm tên).
4. **Hiển thị**: `src/scene/BeaconLayer.js` (marker là con của group tầng tại (x, height_m, z), màu theo trạng thái nếu có nguồn, nhãn id) + `SceneBuilder.getFloorGroup(floorId)` (hàm nhỏ).
5. **Tài liệu**: mục ngắn trong `HUONG_DAN.md`; không tạo tài liệu trùng.

## Ngoài phạm vi
Không đổi "Vị trí của bạn"; không định vị (Phase 5); không Burn/Program; không đổi schema `data/beacons.json`; không cài dependency; không commit/push; không sửa `src/beacon-admin/main.js`; bản `build`/`dist` không có route ghi file và không chứa `beacons.local.json`.

## Phân loại / Rủi ro
SỬA-MÃ + CẤU-HÌNH (`vite.config.js`). Rủi ro: **Vừa → Cao ở phần ghi file**.
- Ghi file từ trình duyệt qua dev server khi `dev:lan` mở 0.0.0.0 → bắt buộc kiểm loopback + Host/Origin; có test cho từ chối nguồn không phải localhost.
- File chứa UUID thật → server không đọc ra client, không log; kiểm gitignore.
- Hệ tọa độ (hướng trục z) vẫn "Cần xác nhận"; số tầng dựng trong cảnh ("Cả 3 tầng" vs 9) chưa rõ → tầng không dựng thì không gán được.
- `src/main.js` lớn → nối dây tối thiểu, logic ở module riêng.

## DoD
- D1: test thuần `beacon_placement` + xử lý yêu cầu: hợp lệ / ngoài khung / tầng lạ / id lạ / gỡ / ghi đè; body có `uuid` bị bỏ qua hoặc từ chối; phản hồi GET không chứa uuid.
- D2: test từ chối khi `remoteAddress` không phải loopback hoặc Origin lạ (403).
- D3: round-trip: ghi → đọc lại đúng; các trường uuid/major/minor trong file không đổi (so sánh băm trên bản sao thử, không in giá trị).
- D4: chạm điểm trên F1 → marker đúng (x, z) cục bộ trong group F1 (test hàm thuần + kiểm trực quan trong trình duyệt tích hợp, dùng bản sao dữ liệu thử, không dùng UUID thật).
- D5: `npm test` ≥ 124 + mới, 0 lỗi; `npm run build` OK; `npm run validate` 0 lỗi; `node --check` mọi JS đổi; `git check-ignore data/beacons.local.json` có luật; grep file tracked không thấy UUID thật.
- D6 (người dùng): vị trí marker khớp chỗ gắn thật.

## Câu hỏi còn lại (có mặc định, trả lời hoặc nhắn "dùng mặc định")
2. Danh sách beacon lấy từ `data/beacons.local.json` có sẵn (mặc định), hay thêm beacon mới ngay trong chế độ gán (nhập Major/Minor, dán UUID)? Thêm mới làm tăng rủi ro vì UUID đi qua trình duyệt → mặc định: KHÔNG làm.
3. Chỉ lưu tọa độ + tầng (mặc định), hay gắn luôn `roomId`/door node (cần duyệt thay đổi dữ liệu)?
