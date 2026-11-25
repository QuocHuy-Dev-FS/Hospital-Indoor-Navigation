# PROMPT CHUẨN – Demo di động: "Vị trí đứng → đường tới phòng có beacon" (3D, kiểu Google Maps)

Ngày: 2026-11-09 · Trạng thái: CHỜ CỔNG DUYỆT ("HÃY THỰC THI PROMPT NÀY")
Đã chốt với người dùng: (1) vị trí đứng demo = một phòng/nút có sẵn; (2) trên giao diện 3D laptop, người dùng chọn phòng để gắn beacon vào; (3) dùng cách bảo mật tốt nhất: route công khai đã lọc UUID + chặn file local với client không phải loopback.

## 1. MỤC TIÊU
Điện thoại mở `http://172.16.29.100:5173` (qua `npm run dev:lan`). Người dùng tìm phòng **có beacon đã gắn**, chọn điểm xuất phát (phòng/nút có sẵn), thấy chấm "Bạn ở đây" kiểu Google Maps và tuyến 3D tới phòng đó. Laptop có thao tác chọn phòng 3D để gắn beacon vào phòng. Tối ưu giao diện di động. Bản thử nghiệm; phase dự án không đổi.

## 2. PHẠM VI
Được đụng (sao lưu `*.bak-2026-11-09` trước khi sửa file có sẵn):
- Di động: `src/ui/mapFlow.js`, `src/ui/mobile-flow.css`, `src/main.js` (phần mobile-flow/tìm kiếm/camera/BeaconLayer), `src/scene/BeaconLayer.js`, `src/positioning/position_provider.js`, `src/nav/route_summary.js`, `index.html` (phần mobile-flow).
- Gắn beacon vào phòng (laptop, dev-only): `src/ui/beaconPlacementUI.js`, `src/positioning/beacon_placement.js`, `tools/beacon_placement_server.mjs`: thêm thao tác chạm phòng 3D → lưu `roomId` (và `x,z` lấy từ phòng) cho beacon đã chọn; cho phép "Gỡ phòng".
- Bảo mật dev server: `vite.config.js` (+ `tools/beacon_placement_server.mjs`): route chỉ-đọc công khai đã lọc + chặn non-loopback (mục 3.9).
- `tools/dev-lan.mjs` (chỉ nếu cần in IP/cổng), `tests/` (test mới), `package.json` (chỉ `scripts.test`), `HUONG_DAN.md` (mục demo), `README.md` nếu cần.

KHÔNG đụng: nội dung `data/*.json` có sẵn (chỉ `data/beacons.local.json` được ghi qua server gán beacon, thêm trường `roomId`, gitignored); `data/beacon-map*.json`; `scan/`; `beacon-admin.html`, `src/beacon-admin/*`; bố cục desktop, `?kiosk`, `?force2d`, `?model=glb`; `docs/` ngoài báo cáo đội.

## 3. RÀNG BUỘC (CLAUDE.md)
1. Chỉ phase hiện tại (Chuẩn bị → chờ Phase 0); không đánh dấu Phase 4/5/6 xong. Liên kết beacon↔phòng chỉ là dữ liệu local thử nghiệm, không phải Phase 5.
2. Không cài dependency (chỉ Three.js 0.186.1, Vite có sẵn).
3. Không UUID/Major/Minor thật trong code, log, test, tài liệu, ảnh chụp, báo cáo. Test dùng dữ liệu giả.
4. Không commit/push/deploy. Không Burn/Program beacon.
5. Không ghi đè dữ liệu ngoài `data/beacons.local.json` (qua server gán, có `.bak-<ngày>` và gitignore sẵn); không dùng lệnh phá hủy.
6. Không bịa kết quả; chưa chạy trên điện thoại thật thì ghi "chưa".
7. Vị trí chỉ trong bộ nhớ, không vào URL/history/log.
8. Thay đổi nhỏ nhất; không tắt test.
9. **Bảo mật dev server (cách chọn):** thêm route dev-only chỉ-đọc trả danh sách beacon đã lọc (`id`, `floorId`, `x`, `z`, `height_m`, `status`, `roomId`; không `uuid/major/minor`); chặn `GET /data/beacons.local.json`, `/data/beacon-map.local.json` và `.bak` của chúng khi `remoteAddress` không phải loopback (127.0.0.1, ::1, ::ffff:127.0.0.1). Laptop giữ nguyên nên beacon-admin và "Gán beacon" vẫn chạy. Các route ghi vẫn chỉ loopback. Không áp dụng cho build/production.

## 4. DoD
a. `npm test` PASS, không thấp hơn 140/140, cộng test mới: lọc bỏ uuid/major/minor; chặn non-loopback; ghi/xoá `roomId` hợp lệ (phòng phải tồn tại, beacon phải tồn tại, một phòng có thể bị từ chối nếu trùng theo quy tắc nêu ở mục 6); tìm phòng có beacon; beacon chưa gắn phòng bị ẩn khỏi kết quả tìm của điện thoại.
b. `npm run build` OK; `npm run validate` 0 lỗi (cảnh báo cũ giữ); `node --check` OK mọi file JS đổi.
c. Chạy `dev:lan` thử ở cổng khác rồi dừng; `curl`/Node: route công khai 200 và grep không thấy UUID; `/data/beacons.local.json` từ client không phải loopback bị 403/404. Không giả lập được LAN thì ghi rõ "chưa kiểm HTTP qua LAN" và dựa vào test đơn vị.
d. Trình duyệt tích hợp 430×932 và 375×667: S1 tìm ra phòng có beacon → S2 chọn xuất phát (phòng/nút có sẵn) → S3 có chấm "Bạn ở đây" (nhãn "Vị trí demo"), tuyến liên tục tới phòng đích, camera 3D nghiêng, thanh chỉ dẫn + khoảng cách ước tính; đổi tầng hiển thị đúng. Laptop: chạm phòng 3D gán được beacon, marker hiện đúng. Có ảnh chụp.
e. Cỡ chạm ≥ 44 px; chữ chính ≥ 16 px (nhãn 3D ghi ngoại lệ); không cuộn ngang; bottom sheet không che nút chính.
f. Desktop 1440×900 và `?kiosk=1` không đổi.
g. grep UUID thật trong diff/báo cáo: rỗng. Hash `data/*.json` ngoài `beacons.local.json` không đổi.

## 5. PHẢI GIỮ NGUYÊN
State machine S0–S3; `CONFIDENCE_MIN=0.5`, `STALE_MS=15000`; geofence chưa cấu hình → không gọi GPS; định tuyến (xe lăn không dùng cầu thang); schema và tên node `F<tầng>_R<số>`; "Gán beacon" chỉ dev laptop, tắt ở mobile-flow/`?kiosk`/build; cầu nối `/api/loc/*` (POST chỉ loopback); client không gửi/nhận UUID; mọi dữ liệu beacon cũ trong `beacons.local.json` không bị mất (chỉ thêm `roomId`).

## 6. GIẢ ĐỊNH
- Điện thoại cùng LAN, tường lửa mở cổng 5173: Cần xác nhận (lỗi môi trường thì báo, không sửa hệ thống).
- IP 172.16.29.100 là IP LAN hiện tại (thấy trong `ipconfig`), có thể đổi.
- GPS/Web Bluetooth không chạy qua HTTP IP LAN → vị trí đứng là do người dùng chọn (phòng/nút có sẵn, `?from=`, cầu nối); nhãn "Vị trí demo".
- "Quét được beacon" trên laptop dùng `beacon-admin` hiện có; việc gắn phòng làm ở giao diện 3D chính (chọn beacon từ danh sách → chạm phòng). Không sửa beacon-admin.
- `x,z` của beacon khi gắn phòng lấy từ vị trí chạm trong phòng nếu có, ngược lại từ nút cửa/tâm phòng: Cần xác nhận quy tắc ưu tiên; mặc định giữ `x,z` đã gán, chỉ đặt từ phòng nếu đang null.
- Một phòng có thể có nhiều beacon (mặc định cho phép); điểm đích = phòng. Cần xác nhận.
- `beacon-map.local.json` trỏ `F1_R101` không tồn tại: không dùng làm nguồn; nguồn là `roomId` trong `beacons.local.json`.
- Hướng trục z và số tầng dựng (3 hay 9) còn mở: dùng hệ tọa độ hiện có.

## 7. PHÂN LOẠI
`SỬA-MÃ/DỮ-LIỆU/CẤU-HÌNH` · Rủi ro **Vừa** (đụng `vite.config.js`, thêm trường `roomId` vào file local, chặn truy cập dữ liệu) · không dependency, không commit, không migration · có đổi bảo mật cục bộ dev server → qua cổng duyệt.

## 8. CẦN NGƯỜI DÙNG QUYẾT
Không có (đã chốt 3/3); các mặc định ở mục 6 áp dụng nếu không góp ý.
