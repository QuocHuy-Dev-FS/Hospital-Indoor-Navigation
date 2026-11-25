# ARCHITECTURE

> **Trạng thái: bản nháp, chưa chốt.** Lựa chọn công nghệ chốt ở Phase 1. Mục "Cần xác nhận" phải được xác minh bằng tài liệu chính thức/khảo sát.

## 1. Thành phần

| Thành phần | Vai trò | Giai đoạn |
|---|---|---|
| Pipeline sơ đồ → 3D | Tạo GLB + dữ liệu hình học từ sơ đồ | Phase 2 |
| Kho dữ liệu | Phòng, khoa, nút, cạnh, beacon (JSON) | Phase 3 |
| Viewer 3D + tìm kiếm | Hiển thị, chọn tầng, tìm phòng | Phase 4 |
| Module định vị BLE | Quét beacon, lọc RSSI, ước lượng vị trí/tầng | Phase 5 |
| Module dẫn đường | A*/Dijkstra, sinh chỉ dẫn | Phase 6 |
| Module AR | Mũi tên chồng camera + fallback | Phase 7 |
| Admin | Quản lý dữ liệu/beacon, phát hành bản đồ | Phase 8 |

## 2. Luồng dữ liệu

```
Sơ đồ (ảnh/PDF/DWG)
   └─► tools/ (vector hóa, dựng 3D) ─► assets/models/*.glb  (node: F1_R101 ...)
                                    └► data/*.json (phòng, nút, cạnh)

Runtime trên thiết bị:
 beacon BLE ─► quét RSSI ─► lọc ─► ước lượng (vùng → trilateration/fingerprint)
                                      │  (tọa độ + tầng, cùng hệ tọa độ với GLB)
 người dùng chọn phòng ───────────────┤
                                      ▼
                         đồ thị + A* ─► tuyến ─► chỉ dẫn chữ/giọng nói/AR/viewer
```

Nguyên tắc: **một hệ tọa độ duy nhất** (mét, trục thống nhất) cho GLB, dữ liệu nút và vị trí beacon.

## 3. Phương án nền tảng (so sánh sơ bộ)

| Tiêu chí | Native / cross-platform (Flutter, React Native + ARKit/ARCore) | PWA / WebXR |
|---|---|---|
| Quét BLE | Hỗ trợ qua API hệ điều hành/thư viện (**Cần xác nhận** thư viện cụ thể) | Web Bluetooth **không hỗ trợ trên Safari/iOS** (nguồn: beaconzone.co.uk/blog/browser-support-for-web-bluetooth) |
| AR | ARKit/ARCore (**Cần xác nhận** tài liệu chính thức) | WebXR: trên iOS Safari chưa xác minh được hỗ trợ đầy đủ trên iPhone; bài 2026 chỉ nêu visionOS |
| Cài đặt | Qua store / MDM | Mở bằng trình duyệt, không cần cài |
| Offline | Mạnh | Hạn chế hơn |
| Chi phí duy trì | Cao hơn | Thấp hơn |

**Khuynh hướng sơ bộ (chưa quyết):** native/cross-platform vì cần quét BLE ổn định trên iOS. Phase 1 xác nhận. Với kiosk, có thể là Web (vị trí cố định, không cần BLE) — **Cần xác nhận** cùng dự án kiosk.

## 4. Chuẩn beacon (chọn ở Phase 1)
- **iBeacon:** hỗ trợ tốt trên iOS (ranging theo UUID đã khai báo). **Cần xác nhận** giới hạn nền.
- **Eddystone:** định dạng mở của Google; hỗ trợ iOS/Android **Cần xác nhận**.
- Tiêu chí: hỗ trợ iOS, tuổi thọ pin, báo pin, chi phí, quản lý từ xa.

## 5. Định vị (lộ trình kỹ thuật)
1. **Proximity/zone** – beacon mạnh nhất quyết định vùng (ổn định, dễ làm).
2. **Trilateration** – từ ≥3 beacon (nhạy với nhiễu).
3. **Fingerprinting** – lập bản đồ RSSI lúc khảo sát (tốn công, ổn định hơn).
4. **Lọc:** trung bình trượt hoặc Kalman cho RSSI; bỏ ngoại lai.
5. **Nhận biết tầng:** beacon cầu thang/thang máy, kèm áp kế nếu có (**Cần xác nhận**).
6. **Snap-to-graph:** gán vị trí vào cạnh/nút gần nhất để tránh "đi xuyên tường".

## 6. Backend và lưu trữ (chốt ở Phase 1)
- Nhu cầu tối thiểu: phân phối gói dữ liệu bản đồ có version; admin; (tùy chọn) thống kê ẩn danh.
- Offline-first: app giữ bản sao dữ liệu + GLB; cập nhật khi có mạng.
- Hosting: trong mạng bệnh viện hay cloud — **phụ thuộc quy định quân y (Cần xác nhận)**.

## 7. Lý do chọn công nghệ (ghi sau Phase 1)
Mỗi quyết định ghi: lựa chọn – phương án đã loại – lý do – nguồn – ngày.

## 8. Ràng buộc đã biết
- RSSI dao động theo người, tường, thiết bị y tế; mục tiêu sai số: **Cần xác nhận**.
- Quyền riêng tư: xem [PRIVACY_SECURITY.md](PRIVACY_SECURITY.md).
- Thiết bị tối thiểu, độ phân giải kiosk: **Cần xác nhận**.

## 9. Mô hình triển khai: một beacon mỗi phòng

> **Giả thuyết thiết kế — chốt chính thức ở Phase 1.**

**Nguyên tắc:** mỗi phòng hoặc điểm đến quan trọng có **một beacon**. Beacon đóng vai trò mốc nhận dạng đích, không phải nguồn định vị tọa độ chính xác. Ánh xạ: `beacon.id ↔ room.id` (xem [DATA_MODEL.md](DATA_MODEL.md)).

**Luồng dùng:** người dùng mở app → chọn đích → đi theo hướng dẫn bước → khi app nhận tín hiệu beacon của đích đủ mạnh → báo "Đã tới nơi".

**Phương pháp định vị chính:** proximity/zone (beacon mạnh nhất quyết định vùng/phòng hiện tại). Trilateration và fingerprinting là **tùy chọn nâng cao** nếu proximity chưa đủ chính xác (xem mục 5).

**Rủi ro đã biết:**
- Số beacon tăng tuyến tính theo số phòng → chi phí phần cứng và công lắp đặt tăng tương ứng.
- Mỗi bo chỉ **Burn một lần** (eFuse OTP, không đảo ngược) → phải chốt UUID/Major/Minor/chu kỳ phát/công suất bằng văn bản trước khi Burn; cần chuẩn bị bo dự phòng.
- Vị trí xuất phát khi người dùng chưa gần phòng nào: cần phương án thủ công (chọn tầng/khu vực trên bản đồ).
- Chồng lấn tín hiệu phòng liền kề: một beacon có thể bị nhận nhầm sang phòng bên cạnh khi tường mỏng — cần bench test thực tế.
- 1 bo hiện có chưa đủ kiểm chứng khả năng phân biệt nhiều phòng liền nhau.
- Phương án lỗi an toàn khi mất tín hiệu beacon: chuyển về chỉ dẫn theo mốc hình ảnh (tên khoa, mũi tên trên bản đồ 2D/3D).

## 10. Thiết bị thử nghiệm hiện có

> Danh sách tại thời điểm 2026-10-26. Cập nhật khi có thêm thiết bị. Chi tiết kỹ thuật: [docs/HARDWARE.md](HARDWARE.md).

| Thiết bị | Số lượng | Ghi chú |
|---|---|---|
| Bo beacon DFRobot "BLE Sensor Beacon V1.0" (Gravity) | 1 | SKU TEL0149 — **Cần xác nhận** đối chiếu bo |
| Cáp CP2102 USB-TTL | 1 | Điện áp 3.3 V hay 5 V — **Cần xác nhận** |
| Điện thoại Android + nRF Connect | 1 | Đời máy và phiên bản OS — **Cần xác nhận** |
| Điện thoại iOS | ? | Có không — **Cần xác nhận** |
| Máy tính chạy NanoBeaconConfigTool | 1 | Hệ điều hành — **Cần xác nhận** |
