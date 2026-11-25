# Prompt chuẩn (NHÁP, chờ duyệt Cổng 1) — Chế độ "Gán beacon trên bản đồ 3D"

Ngày: 2026-11-09 · Nhánh: master (chưa có commit) · Phase dự án: Chuẩn bị → chờ Phase 0 (không đổi)
Liên quan: `docs/prompts/2026-11-09-beacon-map-plan-a-v2.md` (nháp, chưa duyệt) và Plan A 2026-11-02. Prompt này THAY ĐỔI hướng Plan A: thay vì nạp tọa độ từ file, người dùng đặt beacon bằng cách chạm lên bản đồ 3D. Nếu duyệt, v2 sẽ gộp vào đây.

## Mục tiêu
Sau khi beacon đã được định danh (UUID/Major/Minor đã biết, đã quét/đăng ký), người dùng chỉ cần mở bản đồ 3D, chọn beacon, chạm điểm trên sàn/tường/trần của đúng tầng để gán vị trí. Không cần quét lại hay sửa tay file JSON. Vị trí gán được lưu bền và dùng được cho marker hiển thị (Plan A) và về sau cho định vị (Plan B, Phase 5).

## Phạm vi (đề xuất)
1. **Chế độ "Gán beacon"** (bật bằng nút trong sidebar mục beacon, chỉ desktop, không bật ở `?kiosk`):
   - Danh sách beacon đã đăng ký (id F1_B01…, trạng thái đã/chưa gán vị trí). UUID không hiển thị.
   - Chọn beacon → chạm bản đồ 3D: raycast (`src/main.js:302-337` đã có Raycaster cho phòng) lấy điểm (x, z) trong hệ tọa độ dự án (mét, X đông, Z nam), tầng = tầng đang chọn, `height_m` mặc định 2.5 (sửa được).
   - Xem trước marker, nút Xác nhận / Hủy / Gỡ vị trí; kéo thả để chỉnh.
   - Tự gợi ý phòng chứa điểm (so với `rooms.json` bounds) để hiển thị; KHÔNG ghi `roomId` vào dữ liệu trừ khi duyệt (xem Q ở dưới).
2. **Lưu trữ vị trí** (chọn 1 phương án, xem câu hỏi 1):
   - P1: xuất/nhập file JSON qua nút tải xuống / chọn file (không cần server, an toàn nhất; người dùng tự đặt file vào `data/beacons.local.json`).
   - P2: middleware chỉ-localhost của `vite.config.js` (cùng kiểu `/api/loc/*`) ghi vào `data/beacons.local.json` (gitignored). Tiện hơn nhưng là thay đổi cấu hình dev server và ghi file từ trình duyệt.
   - Mặc định đề xuất: P1 trước, P2 làm bước sau nếu cần.
3. **Mô-đun thuần có test**: `src/positioning/beacon_placement.js` (validate điểm: nằm trong khung tầng, tầng có trong cảnh, ghi đè/gỡ, serialize chỉ gồm id, floorId, x, z, height_m — không UUID), `tests/beacon_placement.test.mjs`.
4. **Hiển thị**: `src/scene/BeaconLayer.js` (marker là con của group tầng, theo Plan A) + `SceneBuilder.getFloorGroup(floorId)`.
5. **Hướng dẫn**: thêm mục ngắn vào `HUONG_DAN.md`.

## Ngoài phạm vi
Không đổi "Vị trí của bạn"; không định vị (Phase 5); không Burn/Program beacon; không đổi schema `data/beacons.json` (chỉ dùng trường đã có: floorId, x, z, y/height_m); không cài dependency; không commit/push; không sửa `src/beacon-admin/main.js` trừ khi duyệt riêng.

## Phân loại / Rủi ro
SỬA-MÃ (+ có thể CẤU-HÌNH nếu chọn P2). Rủi ro: **Vừa**.
- Ghi file từ trình duyệt (P2) và dữ liệu có UUID thật → bảo đảm chỉ localhost, ghi vào file gitignored, không log UUID.
- Hệ tọa độ trong `coordinate_system.json` vẫn "Cần xác nhận" (hướng trục z) → vị trí gán bằng chạm sẽ nhất quán với mô hình, nhưng chưa chắc khớp thực tế.
- Số tầng thực sự dựng trong cảnh (UI ghi "Cả 3 tầng" vs 9 tầng dữ liệu) chưa rõ; tầng không dựng → không gán được.
- `src/main.js` rất lớn (~2300+ dòng); thêm mã vào đó dễ xung đột → ưu tiên module riêng, chỉ nối dây tối thiểu.

## DoD (đo được)
- D1: test thuần cho `beacon_placement.js` đạt (điểm hợp lệ/ngoài khung/tầng lạ/gỡ/ghi đè; serialize không chứa uuid).
- D2: chạm một điểm trên F1 với beacon đã chọn → marker xuất hiện đúng (x, z) cục bộ trong group F1 (kiểm bằng test hàm thuần + kiểm trực quan trong trình duyệt tích hợp).
- D3: xuất file → nạp lại → vị trí khôi phục giống hệt (test round-trip).
- D4: `npm test` ≥ 124 + test mới, 0 lỗi; `npm run build` OK; `npm run validate` 0 lỗi; `node --check` mọi file JS đổi; `git check-ignore data/beacons.local.json` có luật; grep file tracked không có UUID thật.
- D5: người dùng tự xác nhận trên thiết bị thật: vị trí marker khớp chỗ gắn thật (không tự động hóa được).

## Câu hỏi cần trả lời trước khi thực hiện
1. Lưu vị trí bằng cách nào: P1 (tải xuống/nạp file JSON), hay P2 (dev server ghi thẳng vào `data/beacons.local.json`)?
2. Danh sách beacon "đã quyết" lấy từ đâu: `data/beacons.local.json` (đã có UUID/Major/Minor), hay cho phép thêm beacon mới ngay trong chế độ gán (nhập Major/Minor, UUID dán từ nRF Connect)?
3. Vị trí gán có cần gắn luôn phòng (`roomId`/door node) để dùng sau cho định vị theo phòng không, hay chỉ lưu tọa độ (x, z, tầng)?
