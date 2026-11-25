# ROADMAP – Hospital Indoor Navigation (Bệnh viện Quân y 7A)

**Quy ước:** `[CHAT]` = làm ở Claude Chat (lập kế hoạch, nghiên cứu, soạn prompt). `[AG]` = làm ở Claude Code trong Antigravity (thực thi). `[USER]` = việc của chủ dự án (khảo sát, cung cấp dữ liệu, phê duyệt).
Chỉ làm **phase hiện tại**. Không chuyển phase khi chưa đạt DoD. Chỗ chưa biết ghi **Cần xác nhận**.

**Phase hiện tại:** Chuẩn bị (khung tài liệu hoàn tất) → chờ bắt đầu Phase 0.

---

## Phase 0 – Khảo sát & chốt yêu cầu
**Mục tiêu:** Chốt phạm vi: tầng/khoa/phòng, đối tượng, thiết bị, ràng buộc bệnh viện, ngân sách beacon, môi trường sóng.
**Phụ thuộc:** không.

**Việc theo thứ tự:**
1. [USER] Gửi sơ đồ mặt bằng (ảnh/PDF/CAD) tất cả tầng; ghi độ phân giải/tỉ lệ nếu biết.
2. [USER] Lập danh sách tầng/khoa/phòng cần đưa vào bản đồ (mức ưu tiên: khu bệnh nhân ngoại trú trước).
3. [CHAT] Chốt nhóm người dùng (bệnh nhân, người nhà, người cao tuổi, xe lăn) và yêu cầu truy cập; ngôn ngữ giao diện.
4. [USER] Chốt thiết bị mục tiêu: iOS/Android (phiên bản tối thiểu), có kiosk hay không (liên hệ dự án kiosk, nếu có).
4a. [USER] Đối chiếu mã in trên bo/hộp beacon với SKU TEL0149; ghi kết quả vào `docs/HARDWARE.md`.
4b. [USER] Xác nhận và điền vào `docs/HARDWARE.md`: số lượng beacon cần (so với số phòng), thiết bị Android (đời/phiên bản OS), có iPhone không, hệ điều hành máy tính chạy NanoBeaconConfigTool.
4c. [USER] Đọc hình đấu nối cổng P1 trên wiki ([wiki.dfrobot.com/tel0149/docs/22130](https://wiki.dfrobot.com/tel0149/docs/22130)); xác nhận chiều TX↔RX và điện áp cáp CP2102 trước khi nối. **Không đoán — nhìn hình.**
4d. [USER] Thử **Run in RAM** trên 1 bo (UUID/Major/Minor thử, không dùng giá trị thật); kiểm tra beacon xuất hiện bằng nRF Connect; ngắt nguồn hoàn toàn trước lần thử thứ 2. **TUYỆT ĐỐI KHÔNG bấm Burn/Program.** Xem HUONG_DAN.md mục 8.
4e. [USER] Bench test RSSI: đo tại 1 m / 2 m / 4 m, nhiều điều kiện (hành lang trống, đông người, sát tường, gần thang máy); ghi bảng theo HUONG_DAN.md mục 7.
4f. [CHAT] Chốt **chính sách Burn** bằng văn bản (số bo cần, số bo dự phòng, quy ước UUID/Major/Minor/chu kỳ phát/công suất) và **mô hình mốc** (chỉ beacon phòng hay thêm nút giao/sảnh/thang).
5. [USER] Xin quy định bệnh viện: được phép gắn thiết bị, khu vực hạn chế/quân sự, quy định bảo mật.
6. [USER] Xác định ngân sách beacon và nguồn cấp (pin/nguồn điện).
7. [USER] Khảo sát nhiễu sóng: thiết bị y tế, tường dày/phòng chì (X-quang), thang máy, Wi-Fi 2.4 GHz.
8. [CHAT] Tổng hợp thành tài liệu yêu cầu; soạn prompt cập nhật tài liệu cho Antigravity.
9. [AG] Cập nhật `docs/` và `PROJECT_STATUS.md` theo yêu cầu đã chốt.

**Đầu ra:** `assets/floorplans/*`, danh sách phòng thô (`data/`), mục yêu cầu đã chốt trong `docs/ARCHITECTURE.md`.
**Rủi ro:** thiếu/mờ sơ đồ; quy định quân y hạn chế gắn thiết bị hoặc đăng sơ đồ; ngân sách thấp; tối ưu pin và giới hạn quét nền trên Android; chồng lấn tín hiệu phòng sát nhau.
**DoD:** (a) đủ sơ đồ mọi tầng trong phạm vi; (b) danh sách phòng/khoa được chủ dự án xác nhận; (c) văn bản/xác nhận cho phép gắn beacon hoặc ghi rõ ràng buộc; (d) sai số mục tiêu được chốt bằng số; (e) mục "Câu hỏi mở" không còn câu chặn Phase 1; **(f) có số liệu bench test RSSI cho ít nhất 1 bo beacon; (g) đã chốt chính sách Burn bằng văn bản (bước 4f).**

---

## Phase 1 – Chọn công nghệ & kiến trúc
**Mục tiêu:** Chọn nền tảng ứng dụng, chuẩn beacon, backend, lưu trữ, chế độ offline.
**Phụ thuộc:** Phase 0 đạt DoD.

**Việc:**
1. [CHAT] Nghiên cứu và so sánh: **App native/cross-platform** (Flutter/React Native + ARKit/ARCore) vs **PWA/WebXR**. Ghi rõ: Web Bluetooth không được hỗ trợ trên Safari/iOS (nguồn: beaconzone.co.uk/blog/browser-support-for-web-bluetooth); WebXR trên iOS Safari: bản beta 2022 chỉ có tính năng thử nghiệm, thực tế hỗ trợ trên iPhone **Cần xác nhận** bằng nguồn chính thức (webkit.org / caniuse).
2. [CHAT] So sánh iBeacon vs Eddystone vs BLE advertising tùy biến (hỗ trợ iOS/Android, quét nền, quyền).
3. [CHAT] Quyết định backend (nhẹ/tự host trong mạng bệnh viện hay cloud – cần phù hợp quy định), lưu trữ dữ liệu bản đồ, cơ chế cập nhật không cần phát hành lại app.
4. [CHAT] Quyết định chế độ offline (gói dữ liệu bản đồ + đồ thị nằm trong app).
5. [CHAT] Soạn prompt thực thi cho Antigravity.
6. [AG] Cập nhật `docs/ARCHITECTURE.md` thành bản chốt; tạo khung dự án **sau khi** chủ dự án cho phép cài dependency.
7. [USER] Phê duyệt kiến trúc.

**Đầu ra:** `docs/ARCHITECTURE.md` (bản chốt), bảng so sánh phương án có nguồn, khung dự án tối thiểu.
**Rủi ro:** chọn PWA rồi vướng giới hạn iOS; chọn nền tảng khó duy trì.
**DoD:** quyết định có văn bản cho nền tảng, chuẩn beacon, backend, offline, kèm lý do và nguồn; chủ dự án phê duyệt; có app "Hello world" chạy được trên thiết bị mục tiêu (nếu được phép cài dependency).

---

## Phase 2 – Chuyển sơ đồ thành mô hình 3D
**Mục tiêu:** Từ sơ đồ ra GLB đúng tỉ lệ, node đặt tên theo ID phòng.
**Phụ thuộc:** Phase 0 (sơ đồ), Phase 1 (hệ tọa độ, định dạng).

**Việc:**
1. [CHAT] Phân loại sơ đồ (ảnh/PDF/DWG), chọn phương án A/B/C trong `docs/FLOORPLAN_TO_3D.md`; soạn prompt.
2. [USER] Cho phép cài công cụ (Python, OpenCV/ezdxf, Blender, gltf-transform) nếu cần.
3. [AG] Làm sạch/vector hóa sơ đồ một tầng mẫu; xác định tỉ lệ bằng kích thước thật.
4. [AG] Dựng tường/sàn/cửa tầng mẫu, gán ID phòng.
5. [AG] Xuất GLB, tối ưu, kiểm tra trên viewer.
6. [USER] Đối chiếu tầng mẫu với thực tế.
7. [AG] Nhân rộng cho các tầng còn lại.

**Đầu ra:** `assets/models/*.glb`, `tools/` (script), báo cáo kiểm tra chất lượng.
**Rủi ro:** sơ đồ sai tỉ lệ/cũ; chi tiết phức tạp (cầu thang, sảnh) dựng tự động kém.
**DoD:** mỗi tầng có GLB mở được trên viewer; sai lệch kích thước so với số đo thực ≤ **Cần xác nhận** (đề xuất 2%); 100% phòng trong danh sách có node `F<n>_R<xxx>`; kích thước file ≤ **Cần xác nhận** (theo thiết bị).

---

## Phase 3 – Mô hình dữ liệu & đồ thị đường đi
**Mục tiêu:** Dữ liệu phòng, nút, cạnh, beacon; đồ thị nhiều tầng có lối xe lăn.
**Phụ thuộc:** Phase 2.

**Việc:**
1. [CHAT] Chốt schema theo `docs/DATA_MODEL.md` (điều chỉnh nếu cần), quy tắc trọng số, vùng cấm.
2. [AG] Tạo schema (JSON Schema) và dữ liệu mẫu một tầng.
3. [AG] Viết script kiểm tra: ID duy nhất, tham chiếu hợp lệ, đồ thị liên thông, cạnh hai chiều đúng, thang máy/cầu thang nối đúng tầng.
4. [AG] Sinh đồ thị từ mô hình/sơ đồ (bán tự động) và rà soát.
5. [USER] Rà soát tuyến đường thực tế, đặc biệt lối xe lăn.
6. [AG] Hoàn thiện mọi tầng.

**Đầu ra:** `data/*.json`, `data/schema/*`, `tools/validate_*`.
**Rủi ro:** đồ thị sai ngoài đời thực (cửa khóa, đường một chiều).
**DoD:** script validate chạy qua toàn bộ dữ liệu không lỗi; 100% phòng truy cập được từ sảnh; tồn tại đường xe lăn tới mọi phòng công cộng hoặc ghi rõ ngoại lệ; chủ dự án xác nhận mẫu tuyến.

---

## Phase 4 – Viewer bản đồ 3D + tìm kiếm phòng
**Mục tiêu:** Xem bản đồ 3D, chọn tầng, tìm phòng.
**Phụ thuộc:** Phase 2, 3.

**Việc:**
1. [CHAT] Chốt UX (xoay/zoom/chọn tầng, tìm tên/mã/khoa, gợi ý, tiếng Việt không dấu); soạn prompt.
2. [AG] Dựng viewer (Three.js/Babylon.js theo Phase 1).
3. [AG] Tìm kiếm có gợi ý, chuẩn hóa dấu tiếng Việt.
4. [AG] Highlight phòng, cắt tầng.
5. [AG] Kiểm thử hiệu năng trên thiết bị yếu nhất đã chốt.
6. [USER] Thử trên thiết bị thật.

**Đầu ra:** `src/` viewer, hướng dẫn chạy trong README.
**Rủi ro:** hiệu năng 3D trên máy yếu; chữ nhỏ khó đọc với người cao tuổi.
**DoD:** tải mô hình ≤ **Cần xác nhận** giây; ≥ **Cần xác nhận** FPS trên thiết bị yếu nhất; tìm đúng 100% phòng trong bộ test tên/mã; test tay các thao tác chính đạt.

---

## Phase 5 – Định vị BLE
**Mục tiêu:** Xác định vị trí/tầng từ beacon.
**Phụ thuộc:** Phase 1, 3, 4; beacon đã được gắn (Phase 0 phê duyệt).

**Việc:**
1. [CHAT] Thiết kế thuật toán theo bậc: proximity/zone → trilateration → fingerprinting; chọn bộ lọc RSSI (trung bình trượt/Kalman); nhận biết đổi tầng; bù lệch.
2. [USER] Gắn beacon theo `HUONG_DAN.md`, ghi tọa độ.
3. [AG] Module quét beacon và ghi log RSSI.
4. [AG] Bộ lọc RSSI + định vị theo vùng.
5. [AG] Nhận biết đổi tầng (beacon thang máy/cầu thang, có thể kèm áp kế nếu thiết bị hỗ trợ – **Cần xác nhận**).
6. [AG] Màn hình hiệu chỉnh cho kỹ thuật viên.
7. [AG] Nâng cấp trilateration/fingerprinting nếu proximity chưa đủ.

**Đầu ra:** module định vị, dữ liệu hiệu chỉnh, báo cáo sai số.
**Rủi ro:** RSSI dao động; iOS hạn chế quét nền; nhiễu.
**DoD:** đúng vùng/phòng ≥ **Cần xác nhận** % tại điểm test; sai số trung vị ≤ **Cần xác nhận**; đúng tầng ≥ **Cần xác nhận** %; có số liệu kiểm thử tại hiện trường.

---

## Phase 6 – Dẫn đường
**Mục tiêu:** Chỉ đường từng bước.
**Phụ thuộc:** Phase 3, 5.

**Việc:**
1. [CHAT] Quy tắc câu chỉ dẫn, xử lý lệch tuyến, hồ sơ xe lăn.
2. [AG] A*/Dijkstra trên đồ thị nhiều tầng.
3. [AG] Sinh chỉ dẫn chữ; giọng nói (TTS) tiếng Việt.
4. [AG] Phát hiện lệch tuyến và tính lại.
5. [AG] Chế độ xe lăn (tránh cầu thang/cửa hẹp).
6. [AG] Unit test cho thuật toán.

**Đầu ra:** module dẫn đường + test.
**Rủi ro:** chỉ dẫn mơ hồ; tính lại liên tục do định vị nhiễu.
**DoD:** test đường đi đúng trên bộ tuyến mẫu 100%; tính lại trong ≤ **Cần xác nhận** giây khi lệch; chế độ xe lăn không bao giờ đi qua cầu thang; chủ dự án đi thử.

---

## Phase 7 – AR
**Mục tiêu:** Mũi tên/đường dẫn chồng lên camera.
**Phụ thuộc:** Phase 5, 6.

**Việc:**
1. [CHAT] Chọn kỹ thuật AR theo nền tảng đã chốt (ARKit/ARCore hoặc WebXR); định nghĩa fallback.
2. [AG] Hiển thị mũi tên theo hướng đi tiếp.
3. [AG] Hướng bằng la bàn/cảm biến; hiệu chỉnh.
4. [AG] Fallback khi AR không dùng được (bản đồ 2D/3D + chỉ dẫn chữ).
5. [USER] Thử tại hiện trường.

**Đầu ra:** chế độ AR + fallback.
**Rủi ro:** la bàn lệch trong tòa nhà; thiết bị không hỗ trợ; ánh sáng yếu.
**DoD:** mũi tên lệch hướng ≤ **Cần xác nhận** độ tại điểm test; fallback tự bật 100% khi AR lỗi; không crash khi từ chối quyền camera.

---

## Phase 8 – Công cụ quản trị (admin)
**Mục tiêu:** Đặt beacon lên bản đồ, quản lý phòng/khoa, theo dõi pin, cập nhật bản đồ không phát hành lại app.
**Phụ thuộc:** Phase 3–5.

**Việc:**
1. [CHAT] Chốt vai trò và phân quyền admin.
2. [AG] Giao diện đặt/di chuyển beacon trên bản đồ.
3. [AG] CRUD phòng/khoa/nút/cạnh có kiểm tra dữ liệu.
4. [AG] Theo dõi pin/trạng thái beacon (nếu beacon báo – **Cần xác nhận**).
5. [AG] Cơ chế phát hành bản đồ mới (versioning, rollback).
6. [AG] Nhật ký thay đổi (audit log).

**Đầu ra:** admin tool, quy trình phát hành dữ liệu.
**Rủi ro:** admin sửa nhầm làm hỏng tuyến; lộ quyền.
**DoD:** thay một phòng và phát hành mà không cần build app lại; rollback thử thành công; có đăng nhập và phân quyền; mọi thay đổi có log.

---

## Phase 9 – Kiểm thử hiện trường & hiệu chỉnh
**Mục tiêu:** Đo chất lượng thực tế và hiệu chỉnh.
**Phụ thuộc:** Phase 5–8.

**Việc:**
1. [CHAT] Soạn kịch bản test, mẫu ghi chép, tiêu chí đạt (sai số cho phép đề xuất ≤ 3 m / đúng phòng — **Cần xác nhận**).
2. [USER] Chạy test tại hiện trường (giờ cao điểm/vắng; nhiều thiết bị).
3. [USER] Test với người dùng thật (người cao tuổi, người nhà, xe lăn).
4. [CHAT] Phân tích kết quả, ưu tiên sửa lỗi; soạn prompt.
5. [AG] Hiệu chỉnh tham số, bổ sung beacon, sửa lỗi.
6. [USER] Test lại.

**Đầu ra:** báo cáo kiểm thử, tham số đã hiệu chỉnh.
**Rủi ro:** kết quả khác xa phòng thí nghiệm; thiếu người test.
**DoD:** đạt tiêu chí sai số đã chốt ở Phase 0 trên ≥ **Cần xác nhận** % điểm test; ≥ **Cần xác nhận** người dùng thật hoàn thành nhiệm vụ tìm phòng; không còn lỗi mức nghiêm trọng.

---

## Phase 10 – Bảo mật, quyền riêng tư, triển khai & bàn giao
**Mục tiêu:** Triển khai an toàn, đúng pháp luật, bàn giao.
**Phụ thuộc:** Phase 9.

**Việc:**
1. [CHAT] Rà soát `docs/PRIVACY_SECURITY.md` với quy định hiện hành. **Lưu ý:** Nghị định 13/2023/NĐ-CP theo nguồn PwC đã được thay thế bởi Nghị định 356/2025/NĐ-CP (hiệu lực 01/01/2026) hướng dẫn Luật Bảo vệ dữ liệu cá nhân 2025; **cần pháp chế bệnh viện xác nhận** văn bản áp dụng.
2. [AG] Rà soát mã/quyền/log: không lưu vị trí định danh nếu không cần, không secret trong repo.
3. [USER] Phê duyệt bảo mật của bệnh viện (kiểm tra, ký duyệt nếu yêu cầu).
4. [AG] Gói triển khai, hướng dẫn cài đặt.
5. [USER] Đào tạo nhân viên (dùng `HUONG_DAN.md`).
6. [CHAT] Chuẩn bị tài liệu bàn giao.
7. [AG] Hoàn thiện `HANDOVER.md`, cập nhật tài liệu.

**Đầu ra:** hồ sơ bảo mật, gói triển khai, tài liệu bàn giao.
**Rủi ro:** vướng quy định quân y; dữ liệu vị trí bị coi là dữ liệu cá nhân.
**DoD:** checklist trong PRIVACY_SECURITY.md đạt; có xác nhận bằng văn bản của bệnh viện; nhân viên phụ trách vận hành độc lập được các quy trình trong HUONG_DAN.md; bàn giao đầy đủ.

---

## Bảng theo dõi tiến độ

| Phase | Trạng thái | Ngày | Bằng chứng DoD |
|---|---|---|---|
| Chuẩn bị (khung tài liệu) | Hoàn thành tạo file | 2026-10-23 | Danh sách file trong PROJECT_STATUS.md |
| **Prototype P0.5** | **Hoàn thành** | **2026-10-26** | **npm run dev → giao diện 3D 9 tầng; 18 test pass; build OK; validate 0 lỗi** |
| 0 – Khảo sát & chốt yêu cầu | Chưa bắt đầu | – | – |
| 1 – Công nghệ & kiến trúc | Chưa bắt đầu | – | – |
| 2 – Sơ đồ → 3D | Chưa bắt đầu | – | – |
| 3 – Dữ liệu & đồ thị | Chưa bắt đầu | – | – |
| 4 – Viewer 3D + tìm kiếm | Chưa bắt đầu | – | – |
| 5 – Định vị BLE | Chưa bắt đầu | – | – |
| 6 – Dẫn đường | Chưa bắt đầu | – | – |
| 7 – AR | Chưa bắt đầu | – | – |
| 8 – Admin | Chưa bắt đầu | – | – |
| 9 – Kiểm thử hiện trường | Chưa bắt đầu | – | – |
| 10 – Bảo mật & bàn giao | Chưa bắt đầu | – | – |

## Câu hỏi mở

1. Sơ đồ mặt bằng: định dạng, số tầng, tỉ lệ? (chờ chủ dự án)
2. Có tích hợp với kiosk của Bệnh viện Quân y 7A không (dự án kiosk riêng)? Nếu có, kiosk dùng định vị cố định (vị trí kiosk đã biết)?
3. Nền tảng: native hay PWA? (chốt ở Phase 1)
4. Văn bản pháp luật dữ liệu cá nhân áp dụng: Nghị định 13/2023/NĐ-CP hay Luật BVDLCN 2025 + NĐ 356/2025/NĐ-CP? (nhờ pháp chế xác nhận)
5. Quy định quân y về gắn thiết bị, lưu trữ/hosting dữ liệu, công bố sơ đồ?
6. Ngân sách và số lượng beacon?
7. Sai số cho phép chính thức?
8. WebXR trên iPhone Safari hiện ra sao (nguồn chính thức)? Chưa xác minh được.
9. **[Skill – chờ duyệt, 2026-10-23]** Dùng các skill hệ thống nào? (`code-review`, `security-review`, `impeccable`, `simplify` đã có sẵn – xem HANDOVER.md mục 4). Cần cài thêm ở project-level không?
10. **[Skill – chờ Phase 1]** Nhóm skill mobile/AR (Flutter, React Native, ARKit, ARCore, BLE SDK) chưa đề xuất; xét lại sau khi chốt native hay PWA ở Phase 1.
11. **[CP-SAMPLE3D – 2026-10-23]** `DATA_MODEL.md` liệt kê `type` ∈ clinic|lab|xray|cashier|pharmacy|wc|elevator|stairs|entrance|info|other. Pipeline spike cần `office` (Phòng Trưởng ban, Hành chính, Điều hành, Kỹ thuật) và `storage` (Kho) – hiện gán `other`. Đề xuất bổ sung vào danh mục tại Phase 3 khi chốt schema. **Cần bệnh viện xác nhận danh mục loại phòng đầy đủ.**
12. **[CP-HARDWARE-DOCS – 2026-10-26]** SKU thực tế của bo beacon: TEL0149 hay khác? Đối chiếu mã in trên bo/hộp.
13. **[CP-HARDWARE-DOCS – 2026-10-26]** Số lượng beacon cần so với số phòng bệnh viện: đủ ngân sách không?
14. **[CP-HARDWARE-DOCS – 2026-10-26]** Có iPhone để thử nghiệm và triển khai không?
15. **[CP-HARDWARE-DOCS – 2026-10-26]** Vị trí xuất phát khi người dùng chưa gần phòng nào (không có beacon xung quanh): cần phương án thủ công.
16. **[CP-HARDWARE-DOCS – 2026-10-26]** Phân biệt phòng liền kề: tín hiệu beacon có đủ để app không nhầm phòng kề? Cần bench test với 2 bo đặt gần nhau.
17. **[CP-HARDWARE-DOCS – 2026-10-26]** Cách cấp nguồn/pin cho beacon khi gắn tường: pin, USB hay nguồn điện lưới? Ai thay pin?
18. **[CP-HARDWARE-DOCS – 2026-10-26]** Bo beacon có báo mức pin trong gói phát không? (Chưa tìm thấy bằng chứng trong tài liệu.)
19. **[CP-HARDWARE-DOCS – 2026-10-26]** Ý nghĩa chính xác của "RUN IN RAM" theo yêu cầu từ bên phát thiết bị: họ yêu cầu làm gì cụ thể?
20. **[CP0-PHOTO-SURVEY – 2026-11-02]** Ranh giới F2/F3: ảnh PH_013–015 ở Tầng 1 (F2) hay Tầng 2 (F3)? Cần ảnh cầu thang/biển tầng.
21. **[CP0-PHOTO-SURVEY – 2026-11-02]** Biển "3" tại sảnh thang máy (PH_008): số lượng buồng, số tầng hay khu?
22. **[CP0-PHOTO-SURVEY – 2026-11-02]** Lối chuyển PH_008→PH_009: thang máy, cầu thang, hay lối đi ngang? Ảnh bổ sung cần thiết.
23. **[CP0-PHOTO-SURVEY – 2026-11-02]** Tầng 2 (F3) chưa có ảnh xác nhận — cần chụp thêm để hoàn thành tuyến Sảnh→T1→T2.
24. **[CP0-PHOTO-SURVEY – 2026-11-02]** PH_006–008 thuộc F1 hay F2? Sàn tile trắng khác marble sảnh, có thể đã lên tầng sau khi vào hành lang.
25. **[CP0-FLOORPLAN-STRATEGY – 2026-11-02]** Chờ bệnh viện cho phép chụp sơ đồ thoát nạn PCCC tầng 1 (F1) và tầng 2 (F2). Khi có xác nhận → thực hiện Phương án A theo `docs/FLOORPLAN_REQUEST.md` mục 5.
26. **[CP-UI-MOBILE-FLOW – 2026-11-02]** HTTPS cho điện thoại khi dev (mkcert + Vite https hay reverse proxy)? Chưa cài; cần duyệt công cụ.
27. **[CP-UI-MOBILE-FLOW – 2026-11-02]** Tọa độ geofence khuôn viên BV 7A (polygon hay tâm + bán kính), ai xác nhận? Hiện `data/geofence.json` ở `unconfigured`.
28. **[CP-UI-MOBILE-FLOW – 2026-11-02]** App native để đọc beacon trên iPhone (Safari không có Web Bluetooth)?
29. **[CP-UI-MOBILE-FLOW – 2026-11-02]** Ngưỡng độ tin cậy 0,5 / 15 s / timeout GPS 8 s cần đo thực; `ble_adapter` chưa trả confidence; dữ liệu chưa có trường "khoa"; bản build có phục vụ `/data/*.json` không?
30. **[CP-BEACON-MAP-PLAN – 2026-11-02]** Khóa khớp beacon: yêu cầu ghi `UUID:Major:Minor` nhưng code (`beaconToKey`, `bridge.py`, `iBeaconKey`) dùng `<uuid>-<major>-<minor>` (gạch ngang). Giữ gạch ngang hay đổi? Chưa đổi.
31. **[CP-BEACON-MAP-PLAN – 2026-11-02]** Tọa độ F1_B01 (10.0, 3.2, h 2.0) trùng ví dụ `docs/DATA_MODEL.md:57`; đã đo thật chưa? Trục z đo theo hướng nam (như `coordinate_system.json`)? Cần xác nhận.
32. **[CP-BEACON-MAP-PLAN – 2026-11-02]** F1_B01 chưa gắn phòng; tọa độ nằm trong F1_R003, nhưng `beacon-map.local.json` trỏ F1_R101 (không tồn tại trong `rooms.json`). Cách gắn phòng cho giai đoạn B?
33. **[CP-BEACON-MAP-PLAN – 2026-11-02]** Gói thưa (~1 gói/5 s): chốt hướng nâng timeout theo số gói (K, lostMs), và/hoặc chủ dự án rút chu kỳ phát bằng NanoBeacon Config (Run-in-RAM, không Burn)? Nguyên nhân gói thưa vẫn Cần xác nhận.
34. **[CP-BEACON-MAP-PLAN – 2026-11-02]** UI ghi "Cả 3 tầng" trong khi dữ liệu có 9 tầng; số tầng thực sự dựng trong cảnh chính? Beacon ở tầng chưa dựng sẽ không vẽ.
35. **[CP-BEACON-MAP-PLAN – 2026-11-02]** Giai đoạn B (beacon → "Vị trí của bạn") thuộc Phase 5, chưa tới phase; cần người dùng cho phép riêng. Ngoài ra `CLAUDE.md` §1 vẫn mô tả phân vai Chat/Antigravity — chưa sửa, chờ người dùng quyết.
