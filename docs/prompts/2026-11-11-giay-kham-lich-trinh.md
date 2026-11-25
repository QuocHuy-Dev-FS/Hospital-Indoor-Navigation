# Prompt chuẩn: Giấy khám bệnh / lịch trình khám (bản thử nghiệm)

Đã duyệt 2026-11-11 ("HÃY THỰC THI PROMPT NÀY"). Mặc định cho mục 8: (1) có, bản thử nghiệm dữ liệu giả, không đổi phase; (2) chỉ file mẫu `DEMO-xxxx`, chưa tích hợp HIS; (3) bấm "Tiếp tục" thủ công.

Phase hiện tại: Chuẩn bị, chờ Phase 0 (Prototype P0.5 xong). Không đánh dấu Phase 4/6 hoàn thành.

## 1. MỤC TIÊU
Thêm chế độ "Giấy khám" riêng. Bệnh nhân nhập mã trên giấy khám, app tra danh sách phòng khám theo thứ tự và dẫn đường lần lượt từng phòng, tái sử dụng định tuyến hiện có. Tìm kiếm phòng và luồng "Khám phá bản đồ 3D" giữ nguyên.

## 2. PHẠM VI
Được đụng:
- MỚI `src/visit/visit_plan.js`: chuẩn hóa mã, tra cứu, kiểm tra lịch trình, máy trạng thái chặng. Hàm thuần, không phụ thuộc DOM.
- MỚI `src/ui/visitUI.js`, `src/ui/visit.css`. Nếu `visitUI.js` bắt buộc import `src/main.js` thì dừng và hỏi.
- MỚI `data/visit_plans.sample.json`: chỉ dữ liệu giả (`DEMO-0001`...). Mỗi lịch trình: `code`, `steps[{order, roomId, note?}]`. Không tên/ngày sinh/BHYT thật.
- MỚI `tests/visit_plan.test.mjs`.
- SỬA tối thiểu `index.html` (một nút vào chế độ + một vùng giao diện), `src/main.js` (chỉ đăng ký, không sửa logic cũ).
- SỬA `package.json` chỉ `scripts.test`; `HUONG_DAN.md` (một mục ngắn); `README.md` nếu cần.
- Sao lưu `*.bak-<ngày>` trước khi sửa file có sẵn.

KHÔNG được đụng:
- `src/search/search.js`, `src/nav/astar.js`, `src/nav/instructions.js`, `src/nav/route_summary.js` (chỉ import/gọi).
- `src/ui/mapFlow.js`, `src/positioning/*`, `src/scene/*`, `src/beacon-admin/*`, `scan/`, `beacon-admin.html`, `vite.config.js`.
- `data/rooms.json`, `nodes.json`, `edges.json`, `beacons*.json`.
- Không đọc/ghi UUID thật. Không đụng `docs/agent-runs/` cũ.

## 3. RÀNG BUỘC (CLAUDE.md)
Chỉ phase hiện tại; không cài dependency; không secret/UUID thật; không commit/push/deploy; không ghi đè file có sẵn khi chưa hỏi, không lệnh phá hủy; không bịa kết quả; không vô hiệu hóa kiểm tra; thay đổi nhỏ nhất.
Quyền riêng tư: mã giấy khám coi là dữ liệu liên quan sức khỏe. Chỉ giữ trong bộ nhớ; không localStorage/sessionStorage/cookie; không vào URL/history/log (kể cả `console.*`); không gửi ra mạng. Tiếng Việt có dấu trong UI. Xử lý rõ ký tự dễ nhầm (O/0, I/1/l) khi chuẩn hóa mã và có test.

## 4. DoD
- [ ] `npm test` PASS, không thấp hơn baseline (140 theo PROJECT_STATUS 2026-11-09, Cần xác nhận số thực), cộng ≥ 15 test mới: chuẩn hóa mã (hoa/thường, khoảng trắng, gạch); mã không tồn tại trả lỗi rõ, không ném; `roomId` không tồn tại hoặc trùng liên tiếp bị phát hiện; tôn trọng `order`; chặng kế tính đúng từ phòng hiện tại; bỏ qua/quay lại chặng; xe lăn không qua cầu thang (`pathUsesStairs`); hoàn tất lịch trình; không truy cập storage.
- [ ] `npm run build` OK.
- [ ] `npm run validate` 0 lỗi, không thêm cảnh báo mới.
- [ ] `node --check` OK mọi file JS thêm/sửa.
- [ ] sha256 trước/sau của các file KHÔNG được đụng giống hệt.
- [ ] Grep `localStorage|sessionStorage|document.cookie|console\.` trên file mới rỗng; grep UUID thật rỗng.
- [ ] Kiểm tra trực quan (nếu có trình duyệt tích hợp): nhập `DEMO-0001` → chặng 1/N, "Tiếp tục" → chặng 2; mã sai báo lỗi; tìm kiếm cũ không đổi. Không chạy được thì ghi "chưa kiểm trực quan".

## 5. PHẢI GIỮ NGUYÊN
Tìm kiếm phòng, luồng S0–S3, kiosk, `?force2d`, `?model=glb`, bố cục desktop; A* và sinh chỉ dẫn; hồ sơ xe lăn; toàn bộ `data/*.json` có sẵn; nhãn "Bản thử nghiệm"/dữ liệu demo hiển thị rõ.

## 6. GIẢ ĐỊNH
1. Nguồn mã thật (HIS) chưa có; chỉ file mẫu giả. Cần xác nhận.
2. Định dạng mã thật: Cần xác nhận. Tạm `DEMO-` + 4 chữ số.
3. `roomId` khớp `rooms.json`; dữ liệu phòng toàn thử nghiệm.
4. Xuất phát chặng 1 từ PositionProvider hoặc chọn thủ công (như S2); chặng sau từ cửa phòng vừa xong; bấm "Đã tới / Tiếp tục" thủ công (BLE tự nhận thuộc Phase 5).
5. Tuần tự theo `order`, không tối ưu thứ tự.
6. Dữ liệu mẫu nằm trong client nên không dùng cho bệnh nhân thật; thật cần backend.

## 7. PHÂN LOẠI
SỬA-MÃ/DỮ-LIỆU/CẤU-HÌNH. Rủi ro Vừa (dữ liệu sức khỏe, chạm `main.js` 2.531 dòng, vùng Phase 6). Không dependency, không commit, không migration, không đổi schema thực/bảo mật production.

## 8. ĐÃ QUYẾT
Xem đầu file.
