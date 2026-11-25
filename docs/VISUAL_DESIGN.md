# VISUAL_DESIGN – Thiết kế trực quan 3D Viewer
> Cập nhật: 2026-10-26. Giai đoạn nâng cấp lớp trình bày Phase 4.

---

## 1. Bảng màu theo loại phòng (room type)

Phong cách: sáng, sạch, y tế. Màu pastel nhạt, không dùng màu bão hòa cao.

| Type        | Tên VN           | Màu sàn (hex) | Hex số   | Ghi chú                          |
|-------------|------------------|---------------|----------|----------------------------------|
| `clinic`    | Phòng khám       | Xanh dương nhạt | #BBDEFB | màu y tế chủ đạo                |
| `lab`       | Phòng xét nghiệm | Tím nhạt      | #E1BEE7  |                                  |
| `xray`      | X-Quang / CT     | Xanh xám      | #B0BEC5  | khu chụp chiếu                  |
| `cashier`   | Thu ngân         | Xanh lá nhạt  | #C8E6C9  |                                  |
| `pharmacy`  | Nhà thuốc        | Teal nhạt     | #B2DFDB  |                                  |
| `wc`        | WC               | Xanh biển nhạt| #B3E5FC  |                                  |
| `elevator`  | Thang máy        | Cam nhạt      | #FFCCBC  | nhận biết nhanh                  |
| `stairs`    | Cầu thang        | Xám xanh nhạt | #CFD8DC  |                                  |
| `entrance`  | Sảnh/Lối vào     | Vàng nhạt     | #FFF9C4  |                                  |
| `info`      | Thông tin/Quầy   | Teal sáng     | #E0F7FA  |                                  |
| `office`    | Văn phòng        | Indigo nhạt   | #C5CAE9  | (bổ sung so với DATA_MODEL cũ)  |
| `storage`   | Kho              | Nâu nhạt      | #D7CCC8  | (bổ sung so với DATA_MODEL cũ)  |
| `other`     | Khác             | Xám trắng     | #EEEEEE  |                                  |

**Màu sàn chung** (khi không khớp type): `#E8EEF5` – xanh trắng nhạt

**Màu highlight** (phòng được chọn): Vàng amber `#FFD54F` + emissive `#554400`  
**Màu hover**: Xanh primary `#2196F3` opacity 40%  
**Màu route**: Cyan sáng `#00BCD4` + mũi tên `#0097A7`  
**Màu marker vị trí**: Xanh lá `#4CAF50` + pulse ring `#A5D6A7`

---

## 2. Màu nền và môi trường 3D

| Thành phần         | Giá trị                          | Ghi chú                        |
|--------------------|----------------------------------|--------------------------------|
| Scene background   | `#EEF4FA` (xanh trắng nhạt)     | Thay từ `#1a1a2e` tối           |
| Fog                | FogExp2(`#EEF4FA`, density=0.006) | Sương mù nhẹ theo khoảng cách  |
| HemisphereLight sky| `#B3D9F7`                        | Ánh trời xanh y tế             |
| HemisphereLight ground | `#C8DFC8`                   | Ánh đất xanh lá nhẹ            |
| DirectionalLight   | `#FFFFFF`, intensity 0.8         | Đổ bóng giả từ hướng 20,50,30  |
| ToneMapping        | ACESFilmicToneMapping            | Màu trông tự nhiên hơn         |
| Tường (wall)       | `#FAFCFF` roughness 0.85         | Trắng sứ                       |
| Viền cạnh (edge)   | `#7BA7C9` linewidth 1            | EdgesGeometry mảnh             |
| Sàn sảnh/hành lang | `#DFE9F3`                       | Xanh xám nhạt                  |

---

## 3. Hệ tier chất lượng

Các ngưỡng dưới đây là **giá trị khởi đầu – Cần xác nhận bằng đo thực tế**.

### Phát hiện tier ban đầu

| Điều kiện                          | Tier        |
|------------------------------------|-------------|
| DPR ≥ 2 VÀ cores ≥ 4 VÀ mem ≥ 4  | `high`      |
| Không đạt high, maxTexSize ≥ 4096  | `medium`    |
| DPR ≤ 1 HOẶC cores ≤ 2 HOẶC mem ≤ 2 hoặc không WebGL2 | `low` |
| Saving mode bật                    | `low`       |

### Cấu hình từng tier

| Tính năng               | low            | medium              | high                       |
|-------------------------|----------------|---------------------|----------------------------|
| Pixel Ratio             | 1.0            | ≤ 1.5               | ≤ 2.0                      |
| Shadow                  | Tắt            | DirectionalLight bóng nhỏ | Shadow map 1024     |
| Post-processing         | Tắt            | FXAA                | OutlinePass + FXAA         |
| Bloom route             | Tắt            | Tắt                 | Bật nhẹ (chỉ nếu FPS ≥ 45) |
| Antialias WebGL         | Tắt            | Bật                 | Bật                        |
| Fog                     | Tắt            | Bật                 | Bật                        |
| EdgesGeometry           | Tắt            | Bật                 | Bật                        |
| HemisphereLight         | Ambient đơn    | Hemisphere + Dir    | Hemisphere + Dir           |

### FPS auto-downgrade (Cần xác nhận ngưỡng)

- Đo FPS trong 2–3 giây đầu sau khi scene load
- **high → medium**: FPS < 45 (Cần xác nhận)
- **medium → low**: FPS < 30 (Cần xác nhận)
- Hạ DPR động khi FPS < 25 (Cần xác nhận)
- Không tự nâng tier sau khi đã hạ (tránh dao động)

---

## 4. Danh sách hiệu ứng theo tier

| Hiệu ứng                        | Tier tối thiểu | Mô tả                                         |
|---------------------------------|----------------|-----------------------------------------------|
| Nền gradient sáng               | low            | Scene background #EEF4FA                     |
| Màu phòng theo loại             | low            | MeshStandardMaterial pastel                   |
| Viền cạnh EdgesGeometry         | medium         | LineSegments EdgesGeometry                   |
| HemisphereLight                 | medium         | Sky + ground light                           |
| Sương mù FogExp2                | medium         | Khoảng cách thị giác                          |
| Bóng giả DirectionalLight       | medium         | shadowMap 512 (Cần xác nhận kích thước tốt)   |
| FXAA anti-alias (post)          | medium         | EffectComposer + FXAAPass                    |
| OutlinePass phòng được chọn     | high           | Viền sáng khi chọn phòng                      |
| Tween camera fly-to             | low            | ≤ 1.2 giây easeInOut                         |
| Intro animation                 | low            | Camera fly-in, có thể bỏ qua                 |
| Exploded-view tween             | low            | Tách tầng mượt                               |
| Route draw-on animation         | low            | Vẽ dần từ điểm xuất phát                    |
| Route shader chạy               | medium         | UV animation dọc tube                        |
| Position pulse ring             | low            | Scale animation 1→1.5→1, chu kỳ ≥ 1.5s       |
| Pin đích thả nhẹ                | low            | Drop-in bounce ≤ 0.4s                         |
| Glassmorphism bottom sheet      | medium         | backdrop-filter blur; bỏ blur ở low           |

---

## 5. Ngân sách hiệu năng (Cần xác nhận bằng đo thực)

| Chỉ số              | Mục tiêu               | Tier     | Ghi chú                             |
|---------------------|------------------------|----------|-------------------------------------|
| FPS                 | ≥ 30fps (Cần xác nhận) | low      | Thiết bị yếu nhất                  |
| FPS                 | ≥ 45fps (Cần xác nhận) | medium   |                                     |
| FPS                 | ≥ 55fps (Cần xác nhận) | high     |                                     |
| Draw calls          | Cần xác nhận           | –        | Đo bằng renderer.info.render.calls  |
| Triangles           | Cần xác nhận           | –        | Đo bằng renderer.info.render.triangles |
| Thời gian tải       | Cần xác nhận           | –        | Đo từ loadAll() đến animate()       |
| Bundle JS (gzip)    | 163 KB (hiện tại)      | –        | Không tăng đáng kể                 |

---

## 6. Số đo "trước" → "sau"

> FPS và draw calls **chưa đo được** – không có công cụ trình duyệt trong phiên này.  
> Chủ dự án đo khi chạy `npm run dev` + thêm `?debug=1` vào URL.

| Chỉ số              | Giá trị TRƯỚC | Giá trị SAU       | Ghi chú                    |
|---------------------|---------------|-------------------|----------------------------|
| Draw calls          | Cần xác nhận  | Cần xác nhận      | renderer.info.render.calls |
| Triangles           | Cần xác nhận  | Cần xác nhận      | renderer.info.render.triangles |
| Thời gian tải (ms)  | Cần xác nhận  | Cần xác nhận      | Đo loadAll() đến animate() |
| FPS ổn định         | Cần xác nhận  | Cần xác nhận      | Thiết bị test: Cần xác nhận|
| Bundle JS (gzip)    | 163 KB        | **172 KB** (+9KB) | Tăng do postprocessing lazy-load |
| Bundle CSS (raw)    | 14.78 KB      | **18.76 KB**      | Tăng do UI mới             |
| Tests pass          | 18/18         | **35/35**         | +17 tests mới (tween, tier, label, route) |

---

## 7. Mục chưa xác minh trực quan (cần chủ dự án tự kiểm)

1. Tier detection chạy đúng trên thiết bị thật (low/medium/high)
2. FPS đo được sau 3 giây, auto-downgrade hoạt động
3. Màu phòng theo loại hiển thị rõ ràng, không quá nhạt/tối
4. Viền cạnh EdgesGeometry không quá nhiễu khi zoom out
5. Sương mù không che khuất nhãn quan trọng
6. OutlinePass (tier high) hiển thị viền phòng được chọn
7. Route draw-on animation mượt
8. Pulse animation marker vị trí không gây chóng mặt (chu kỳ ≥ 1.5s)
9. Intro bỏ qua được bằng tap/click
10. Chế độ tiết kiệm (nút trong cài đặt) thực sự hạ DPR xuống 1
11. Glassmorphism bottom sheet: backdrop-filter blur hoạt động
12. Thanh tầng dọc responsive trên mobile
13. Tương phản chữ ≥ 4.5:1 trên nền sáng mới
14. prefers-reduced-motion tắt tất cả animation/transition
15. Ảnh "trước" và "sau": **Chưa chụp được** – cần công cụ trình duyệt


## CP-THREE-FLOOR-UI (2026-10-26)

**Kết quả: Hoàn thành theo yêu cầu chủ dự án: thu gọn còn Tầng trệt, Tầng 1, Tầng 2 và làm giao diện/thao tác ổn định hơn.**

- Giữ ID F1/F2/F3 và tọa độ, chỉ đổi tên hiển thị thành Tầng trệt/Tầng 1/Tầng 2. Lọc toàn bộ dữ liệu runtime cùng lúc: phòng, nút, cạnh, connector và beacon. Không xóa dữ liệu nguồn 9 tầng, không thay GLB tạm.
- Thêm src/ui/floorScope.js: phạm vi 3 tầng và điều kiện phân biệt kéo/chạm. Có 126 phòng trong phạm vi, 42 phòng mỗi tầng theo dữ liệu mẫu hiện có. Không coi đây là số phòng đã khảo sát thực tế.
- Giao diện: khung sáng xanh xám, bảng tìm đường bên trái, một bộ chọn tầng trên bản đồ, Một tầng/Cả 3 tầng, tiện ích SVG và tùy chọn hiển thị mở rộng; điện thoại đặt bản đồ phía trên biểu mẫu. Bổ sung đường dẫn mở trang kiểm thử beacon có sẵn; không triển khai BLE thật trong phiên này.
- Loại bỏ intro tự chạy, nhận double-tap toàn cục, tự bay camera khi chọn phòng và reset bằng setTimeout. Kéo/pinch không mở nhầm phòng; raycast cập nhật theo điểm thả và tầng đang xem. Chỉ nút Xem gần/Toàn cảnh, chỉ dẫn hoặc thao tác vị trí do người dùng chọn mới đổi camera; chuyển động có thể ngắt bằng thao tác tay.
- Camera đặt target đúng tâm, fit toàn bộ tầng theo kích thước canvas, giữ góc/độ phóng khi đổi tầng. Không dùng tween chung cho tầng và camera. Giới hạn góc để không lật xuống dưới sàn.
- Tên tầng đồng nhất trong tìm kiếm, chỉ dẫn chữ/giọng nói và bản đồ 2D; sửa trường hợp sửa nội dung input nhưng vẫn giữ roomId đã chọn trước đó. Gợi ý chọn được bằng bàn phím; bổ sung trạng thái không có kết quả.
- File: index.html, src/main.js, src/map2d/Map2D.js, src/nav/instructions.js, src/ui/floorScope.js, src/ui/wayfinding.css, tests/ui.test.mjs, package.json; không thêm dependency.

### Kiểm chứng

- 75/75 tests đạt: 72 có sẵn + 3 test mới kiểm tra phạm vi/đường đi thường và xe lăn giữa tầng, phân biệt kéo/chạm, tên tầng trong chỉ dẫn. Bộ test chạy lại sau tinh chỉnh không lỗi.
- npm run build thành công; JS chính khoảng 756,9 kB (gzip 198,1 kB), CSS khoảng 34,8 kB. Vite còn cảnh báo chunk >500 kB, không vô hiệu hóa cảnh báo.
- Trình duyệt tích hợp: bấm phòng mở sheet; kéo bản đồ không mở sheet; chuyển tầng và Một tầng/Cả 3 tầng; tìm đường từ tầng trệt đến tầng 2; chọn kết quả bằng ArrowDown/Enter; tìm kiếm không kết quả; không có console error trên trang chính ở lần kiểm cuối.
- Kiểm tra bố cục 1440×900, 768×1024, 390×844; không tràn ngang ở các phép đo responsive. Điện thoại thấy nút Tìm đường đi ngay trong vùng hiển thị. Bản đồ ?force2d=1 có đúng ba nút tầng với tên mới.
- TASTESKILL lint: 0 FAIL, 9 WARN. Các WARN là nhãn section-label của nhóm thao tác (không phải eyebrow trang), shadow chỉ cho sheet/toast nổi và backdrop-filter:none bị nhận theo tên thuộc tính. Impeccable detector chạy; cảnh báo kế thừa từ CSS gốc được đối chiếu với computed style/ảnh cuối (position-status không viền/nền, không glow trên biểu mẫu mới).
- Chọn hướng Framed sheet, seed 123711599, giữ nền nhận diện bệnh viện và dùng mô hình 3D làm nội dung chính. Không dùng ảnh/biểu đồ hoặc số liệu bịa.
- Ảnh xác minh giao diện được lưu trong outputs của chat: giao-dien-3-tang-desktop.png và giao-dien-3-tang-mobile.png.

### Giới hạn giữ nguyên

- Sơ đồ, tên phòng và dữ liệu vẫn là bản thử nghiệm; cần đối chiếu hiện trường. Pipeline GLB và tỉ lệ provisional không được thay trong phiên này.
- Beacon thật chưa kết nối viewer; trang bench có mã riêng và lỗi khởi tạo đã báo trước vẫn ngoài phạm vi phiên giao diện này.
- Chưa thử trên điện thoại phần cứng thật hoặc điều khiển Cốc Cốc trực tiếp; các kiểm tra UI dùng trình duyệt tích hợp với kích thước responsive.
- Người dùng tải lại localhost:5173 (Ctrl+F5) để nhận giao diện mới. Chưa commit/push/deploy.

