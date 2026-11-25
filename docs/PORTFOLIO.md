# Portfolio – Hospital Indoor Navigation (Bệnh viện Quân y 7A)

> Nội dung rút từ README, PRODUCT, PROJECT_STATUS, package.json. Mục nào chưa kiểm chứng đã ghi rõ để không khai quá.
> Sau khi duyệt, có thể lưu thành `docs/PORTFOLIO.md` (hiện CHƯA tạo file nào).

---

## 1. Tiêu đề & tóm tắt (tagline)
**Hospital Indoor Navigation – Hệ thống dẫn đường trong bệnh viện bằng bản đồ 3D và BLE beacon**
Ứng dụng web giúp bệnh nhân và người nhà tìm phòng/khoa trong Bệnh viện Quân y 7A: xem bản đồ 3D, chọn điểm đi, nhận chỉ dẫn từng bước (chữ/giọng nói), hỗ trợ đường đi cho xe lăn.

## 2. Thông tin nhanh
| Mục | Nội dung |
|---|---|
| Loại dự án | Web app (prototype) + công cụ phần cứng/dữ liệu |
| Vai trò | Một mình: thiết kế, lập trình, xử lý dữ liệu, kiểm thử *(cần xác nhận nếu có nhóm)* |
| Trạng thái | Prototype P0.5, dùng **dữ liệu thử nghiệm**; chưa triển khai tại hiện trường |
| Thời gian | Từ 10/2026 (commit/ghi nhận sớm nhất 2026-10-23) |
| Repo | github.com/QuocHuy-Dev-FS/Hospital-Indoor-Navigation (chưa push) |

## 3. Bài toán
- Bệnh viện nhiều tầng, nhiều khoa; bệnh nhân (đặc biệt người cao tuổi, người đi xe lăn) dễ lạc, mất thời gian hỏi người khác.
- GPS không hoạt động trong nhà → cần cách định vị trong nhà chi phí thấp.
- Mục tiêu: tìm phòng nhanh, chỉ đường dễ hiểu bằng tiếng Việt, có phương án không dùng cầu thang.

## 4. Giải pháp
- **Bản đồ 3D** mặt cắt bệnh viện (Three.js), chọn tầng, xoay/zoom, phòng tô màu theo loại.
- **Tìm phòng & tìm đường** bằng thuật toán A* trên đồ thị nút/cạnh, nhiều tầng (thang máy/cầu thang).
- **Chế độ xe lăn**: loại bỏ cầu thang khỏi tuyến.
- **Định vị bằng BLE beacon**: mỗi phòng một beacon, nhận beacon gần nhất để biết vùng hiện tại (proximity/zone), không cần tọa độ chính xác.
- **Luồng di động kiểu Google Maps**: Khám phá → Tìm kiếm → Thiết lập tuyến → Dẫn đường.
- **Dự phòng**: bản đồ 2D SVG khi thiết bị không hỗ trợ WebGL (`?force2d=1`), chế độ kiosk (chữ lớn, nút to).

## 5. Tính năng chính
1. Bản đồ 3D 3 tầng (Tầng trệt, Tầng 1, Tầng 2), nội thất minh họa phong cách bệnh viện.
2. Tìm kiếm phòng có gợi ý, điều khiển bằng bàn phím.
3. Đường đi A* nhiều tầng, chỉ dẫn từng bước + giọng nói.
4. Chế độ xe lăn.
5. Dẫn đường theo thời gian thực: phát hiện lệch tuyến, báo mất tín hiệu.
6. Cầu nối BLE: laptop/điện thoại quét beacon → gửi vị trí tới app (Python `bleak` + WebSocket / relay HTTP + mã ghép cặp).
7. **Trang quản trị beacon** cho kỹ thuật viên: xem beacon đang phát, gán vị trí trên bản đồ 3D, ghi bản ghi hiệu chỉnh RSSI.
8. Pipeline **sơ đồ mặt bằng → mô hình 3D (GLB)** bằng Python (OpenCV, trimesh).
9. Hệ thống chất lượng hiển thị: tự hạ cấu hình theo FPS, render-on-demand, chế độ tiết kiệm pin.

## 6. Công nghệ
| Nhóm | Công nghệ |
|---|---|
| Frontend | JavaScript (ES modules), Three.js 0.186, Vite 5, HTML/CSS (responsive, mobile-first) |
| Thuật toán | A*, đồ thị đa tầng, lọc RSSI (sliding window, hysteresis), hồi quy log-distance |
| Định vị | BLE iBeacon (TEL0149), Web Bluetooth, WebSocket |
| Công cụ | Python 3 (bleak, websockets, OpenCV, NumPy, trimesh), Node.js scripts |
| Kiểm thử | Node test runner – 140 test tự động; Python unittest |
| Quy trình | Claude Code + subagent (planner → executor → verifier) |

## 7. Kiến trúc (sơ đồ ngắn)
```
Sơ đồ mặt bằng ─► Pipeline Python ─► GLB + JSON hình học
Dữ liệu phòng/nút/cạnh/beacon (data/) ─┐
Beacon BLE ─► Bridge (Python/Web) ─► App: RSSI → zone → phòng hiện tại ─► A* ─► Chỉ dẫn chữ/giọng nói
Trang admin beacon ─► gán/hiệu chỉnh beacon ─────────────────────────┘
```

## 8. Thách thức & cách giải quyết
- **WebGL lỗi trên một số trình duyệt** → tìm nguyên nhân gốc (canvas bị khóa context), thêm hiển thị lỗi thật, nút sao chép lỗi, bản đồ 2D dự phòng.
- **Kéo bản đồ bị nhận nhầm là chạm phòng** → phân biệt kéo/chạm, raycast theo điểm thả.
- **HTTP trên LAN không phải secure context** (camera, Web Bluetooth không chạy) → bridge laptop→điện thoại qua relay + mã ghép cặp.
- **Bảo mật UUID beacon** → file `*.local.json` gitignored, client không gửi/nhận UUID, script chẩn đoán chỉ hiện 4 ký tự.
- **Dữ liệu phòng chỉ là sơ đồ mẫu** → phát hiện, ghi nhận và đính chính tài liệu, đánh dấu `provisional` thay vì khai khống.

## 9. Kết quả (đã kiểm chứng)
- 140/140 test tự động đạt; `npm run build` thành công; validator dữ liệu 0 lỗi.
- 126 phòng mẫu (42/tầng × 3 tầng); 78/84 tuyến xe lăn kiểm thử không dùng cầu thang.
- Kiểm tra giao diện trong trình duyệt ở 375×667, 430×932, 768×1024, 1440×900.
- Python: 24 test hiệu chỉnh beacon + 13 test giải mã iBeacon đạt.

## 10. Giới hạn trung thực (nên ghi trong portfolio)
- Dữ liệu phòng/sơ đồ là **thử nghiệm**, chưa đối chiếu hiện trường.
- Chưa chạy trên điện thoại thật; chưa đo RSSI thực tế 10 mốc; chưa có AR.
- Chưa có số liệu người dùng, độ chính xác định vị, hiệu năng thực tế → **không nêu** các số này.

## 11. Bài học / kỹ năng thể hiện
Three.js & đồ họa web · thuật toán đồ thị · làm việc với phần cứng BLE · xử lý dữ liệu/ảnh bằng Python · thiết kế UX cho người cao tuổi · bảo mật dữ liệu · quy trình làm việc có tài liệu & kiểm thử.

## 12. Đề xuất ảnh/demo đính kèm
Ảnh bản đồ 3D desktop & mobile · GIF luồng tìm đường S0→S3 · ảnh trang admin beacon · sơ đồ kiến trúc · link repo (khi push).

## Cần bạn xác nhận
- Vai trò thật (cá nhân hay nhóm), thời gian, có được công khai tên/logo bệnh viện không.
- Muốn bản tiếng Anh, độ dài ngắn (1 trang) hay dài (case study)?
