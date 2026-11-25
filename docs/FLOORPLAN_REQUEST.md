# Phiếu yêu cầu bản vẽ mặt bằng — Bệnh viện Quân y 7A

## 1. Mục đích

Dự án dẫn đường trong nhà (BLE Beacon) cần bản vẽ kiến trúc chính xác để:

- Xác định vị trí phòng/khoa đúng thực tế (tên phòng, loại phòng, vị trí cửa)
- Tính tỉ lệ và tọa độ cho hệ thống định vị beacon
- Dựng mô hình 3D phục vụ giao diện điều hướng trên điện thoại

**Dữ liệu phòng hiện tại (`data/rooms.json`) được sinh từ sơ đồ mẫu, không phản ánh thực tế BV 7A. Toàn bộ gán phòng và dựng mô hình 3D bị chặn cho đến khi có bản vẽ thật.**

---

## 2. Tầng cần cung cấp

| Tầng | ID | Mức ưu tiên | Lý do |
|------|----|-------------|-------|
| Tầng trệt | F1 | **Cao nhất** | Sảnh chính, quầy tiếp tân, thang máy, lối vào |
| Tầng 1 | F2 | **Cao** | Khoa Dược đã xác nhận qua ảnh; cần geometry thật |
| Tầng 2 | F3 | Trung bình | Chưa có ảnh xác nhận; hoàn thiện sau |

---

## 3. Định dạng chấp nhận (ưu tiên từ trên xuống)

1. **DWG / DXF** — bản vẽ CAD, giữ nguyên layer; ưu tiên nhất vì giữ được tỉ lệ chính xác
2. **PDF vector** — bản vẽ kiến trúc hoặc sơ đồ thoát nạn PCCC (không phải PDF scan)
3. **JPG / PNG** — độ phân giải ≥ 150 dpi, không mờ, không bị che khuất bởi chữ/đóng dấu

---

## 4. Thông tin cần kèm theo bản vẽ

- **Tỉ lệ bản vẽ** (ví dụ 1:100, 1:200) — hoặc ít nhất 1 kích thước thực có thể đo được (m)
- **Hướng Bắc** — mũi tên la bàn hoặc ghi chú trên bản vẽ
- **Ngày lập / phiên bản** bản vẽ (để biết có khớp hiện trạng không)
- Nếu có **thay đổi sau bản vẽ** (phòng đập thông, ngăn mới), ghi chú riêng

---

## 5. Nguồn bản vẽ có thể lấy (theo thứ tự nên thử)

### Phương án A — Chụp sơ đồ thoát nạn PCCC trên tường

> **Chỉ chụp khi được bệnh viện cho phép.** Chờ xác nhận từ bộ phận có thẩm quyền trước khi thực hiện.

Mỗi tầng đều có biển sơ đồ thoát nạn PCCC gắn tường gần thang bộ/thang máy. Nếu được phép, đây là nguồn nhanh nhất, thường có tỉ lệ in sẵn trên bản.

**Cách chụp đúng (khi đã được phép):**
- Đứng thẳng trước biển, không chụp xiên (méo perspective làm sai tỉ lệ)
- Chụp cả 4 góc biển, bao gồm phần ghi tỉ lệ (ví dụ "1:200") ở góc dưới
- Độ phân giải: dùng chế độ "Tài liệu" hoặc độ phân giải tối đa của điện thoại
- Chụp 2 kiểu: toàn biển + zoom vào khu trung tâm (sảnh, thang máy, thang bộ)
- Nếu biển bị bóng kính hoặc đèn phản chiếu: chụp góc nghiêng nhẹ ở mỗi hướng để lấy ảnh không lóa

### Phương án B: Bản vẽ kỹ thuật từ bộ phận nội bộ *(ưu tiên dùng để dựng mô hình)*

- **Phòng Kỹ thuật / Ban Cơ sở vật chất**: có thể cấp bản vẽ DWG/PDF, cần công văn hoặc giới thiệu
- **Hồ sơ hoàn công kiến trúc** lưu tại Phòng Hành chính / Ban Chỉ huy: chính xác nhất nhưng thủ tục lâu hơn

> **Ghi chú về cách dùng kết hợp:** Nếu có cả A và B — dùng B để dựng mô hình 3D (độ chính xác cao hơn), dùng A để đối chiếu chéo và phát hiện thay đổi sau khi lập bản vẽ B.

### Phương án C (dự phòng): Đo thực địa

Nếu cả A và B không khả thi: đo trực tiếp các phòng chính bằng thước laser. Tối thiểu cần đo: chiều dài và rộng sảnh, vị trí thang máy, vị trí Khoa Dược. Ghi vào bảng và vẽ phác thảo tay có kích thước.

---

## 6. Phạm vi bảo mật

- Bản vẽ chỉ dùng nội bộ dự án, không đăng lên internet hay chia sẻ bên ngoài.
- Nếu có khu vực hạn chế (quân sự, kỹ thuật đặc biệt): đánh dấu hoặc bỏ qua khu đó trong bản cung cấp; hệ thống sẽ tránh vẽ lối đi qua các khu này.
- UUID beacon và sơ đồ chi tiết không đưa vào repo Git công khai.

---

## 7. Liên hệ

| Vai trò | Tên | Liên hệ |
|---------|-----|---------|
| Chủ dự án & Kỹ thuật | QuocHuy | xem bản in |
| Đại diện bệnh viện | *(điền khi có)* | *(điền khi có)* |

---

## 8. Câu hỏi cần xác nhận khi nhận bản vẽ

Trả lời các câu sau để pipeline chạy đúng:

**Tỉ lệ và hướng (bắt buộc):**
1. Tỉ lệ bản vẽ là bao nhiêu — hoặc đo được 1 đoạn tường/hành lang dài bao nhiêu mét?
2. Hướng Bắc của tòa nhà so với chiều dọc bản vẽ là bao nhiêu độ? (hoặc: lối vào chính nhìn về hướng nào?)
3. Chiều cao thực từ sàn đến trần: tầng trệt là bao nhiêu mét? Tầng 1 có khác không?

**Đối chiếu với phát hiện từ ảnh khảo sát thực địa (đã biết — cần xác nhận vị trí):**
4. **Quầy tiếp tân** (ảnh PH_001, PH_002 — backdrop vàng-trắng "BV Quân y 7A"): nằm ở góc nào của sảnh F1?
5. **Cụm 3 cửa thang máy** (ảnh PH_008 — biển số "3"): thuộc hành lang nào? Bao nhiêu mét từ lối vào chính?
6. **Kiosk sức khỏe** (ảnh PH_005 — kiosk trắng-đỏ): ở khu nào của sảnh F1?
7. **Khoa Dược** (ảnh PH_009 — biển "Department of Pharmacy"): phía Đông hay Tây của tầng F2? Gần thang nào?
8. **Giếng trời / Void** (ảnh PH_010, PH_012 — lan can kính nhìn xuống khu chờ F1): kích thước khoảng bao nhiêu m × m?

**Phạm vi và trạng thái:**
9. Có khu vực nào trong bản vẽ **cấm vào** (quân sự, kỹ thuật đặc biệt) không? Đánh dấu để hệ thống bỏ qua.
10. Bản vẽ có phản ánh đúng hiện trạng không, hay đã có thay đổi (phòng đập/ngăn mới) sau khi lập?
