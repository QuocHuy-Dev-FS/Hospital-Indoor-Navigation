# Prompt chuẩn (NHÁP, chờ duyệt Cổng 1) — Chỉnh Plan A "marker beacon trên bản đồ 3D" (v2)

Ngày: 2026-11-09 · Nhánh: master (chưa có commit) · Phase dự án: Chuẩn bị → chờ Phase 0 (không đổi)
Nguồn: `docs/prompts/2026-11-02-beacon-map-plan.md` (giữ nguyên, không ghi đè). Bản này sẽ là file thay thế mục "Plan A".

## Mục tiêu
Sửa Plan A thành bản v2 "phù hợp" với thực tế hiện tại của repo. Yêu cầu gốc không nói "phù hợp" theo tiêu chí nào → các điều chỉnh dưới đây là ĐỀ XUẤT, cần người dùng xác nhận.

## Loại / Rủi ro
TÀI-LIỆU (chỉ ghi vào `docs/prompts/`; không sửa mã, không chạy build). Rủi ro: Thấp. Thiếu dữ liệu thiết yếu (tiêu chí "phù hợp") → qua cổng duyệt.

## Điều chỉnh đề xuất (từ đối chiếu Plan A với trạng thái hiện tại)
1. **Số liệu lỗi thời:** A6 ghi "103 test + mới"; baseline hiện tại là 124/124 (PROJECT_STATUS, CP-UI-MOBILE-FLOW). Cập nhật.
2. **Giảm phạm vi / rủi ro:** mục 2 của Plan A sửa `src/beacon-admin/main.js` (refactor `getStatus`) để dùng chung. Đề xuất tách: A1 = module thuần `beacon_status.js` + `BeaconLayer.js` + test, KHÔNG đụng admin; refactor admin là bước A2 tùy chọn sau khi test xanh.
3. **Khóa khớp beacon (Q30):** chốt giữ `<uuid>-<major>-<minor>` (gạch ngang) như code, ghi chú khác biệt với yêu cầu `UUID:Major:Minor`.
4. **Tọa độ F1_B01 (Q31/Q32):** đánh dấu A1 là kiểm thử với tọa độ TẠM; nghiệm thu "đúng chỗ" chỉ do người dùng xác nhận bằng mắt; không gắn phòng F1_R101 (không tồn tại).
5. **Timeout (Q33):** dùng tham số `lostMs=10 s`, `K=3` làm mặc định "Cần xác nhận", cấu hình trong một object; không đổi hành vi admin hiện tại.
6. **Phạm vi chạy (Q34):** A chỉ chạy với `npm run dev` (fetch `/data/beacons.local.json`), không đưa vào `dist`; số tầng dựng trong cảnh xác minh bằng đọc `SceneBuilder`/`main.js` trước khi viết A5.
7. **Ranh giới phase:** A không đổi "Vị trí của bạn"; Plan B giữ nguyên là Phase 5, cần cho phép riêng (Q35).

## DoD
- File v2 mới trong `docs/prompts/` (không ghi đè bản 2026-11-02), có: danh sách file/module, tiêu chí A1–A6 cập nhật số liệu, danh mục "Cần xác nhận".
- Không có UUID thật; không sửa mã; không đổi ROADMAP/PROJECT_STATUS ngoài việc ghi checkpoint nếu người dùng yêu cầu.

## Câu hỏi cần người dùng trả lời trước khi thực hiện
1. "Phù hợp" theo hướng nào? (a) thu gọn tối thiểu như đề xuất 2; (b) giữ phạm vi, chỉ cập nhật số liệu/chốt Q30–Q34; (c) hướng khác — mô tả.
2. Chốt Q30 (giữ gạch ngang) và Q33 (K=3, lostMs=10 s làm mặc định) như đề xuất?
3. Beacon thật hiện có mấy cái và tọa độ F1_B01 đã đo chưa (để quyết A1 dùng dữ liệu thật hay Mock)?
