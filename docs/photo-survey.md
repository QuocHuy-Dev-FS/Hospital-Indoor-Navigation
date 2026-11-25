# Khảo sát ảnh thực địa – BV Quân y 7A

> **Trạng thái:** Bản nháp CP0.x – chờ xác nhận tầng và tọa độ.
> **Tạo:** 2026-11-02 · **Phase:** 0 (Khảo sát)

## 1. Tổng quan

| Mục | Giá trị |
|---|---|
| Số ảnh đã phân tích | 15 |
| Nguồn thứ tự | Tên file (1.jpg → 15.jpg) — **không có EXIF DateTimeOriginal** |
| Đường dẫn ảnh gốc (tạm) | `C:\Users\Dell\AppData\Local\Temp\claude\...\images\1.jpg–15.jpg` |
| Đường dẫn đích trong repo | `assets/survey-photos/001.jpg–015.jpg` (thư mục chưa tạo) |
| Tuyến chụp | Sảnh → hành lang → F2 (Tầng 1 trên sảnh) |
| Ảnh Tầng 2 (F3) | **Chưa xác định — xem §5** |

---

## 2. Bảng phân tích từng ảnh

| seq | ID | floorId | Tin cậy tầng | Zone | Landmark chính | Chuyển hướng | faces |
|---|---|---|---|---|---|---|---|
| 1 | PH_001 | F1 | chắc chắn | lobby | Quầy tiếp tân BV Quân y 7A; camera CCTV | → PH_002 straight | ✓ |
| 2 | PH_002 | F1 | chắc chắn | lobby | Biển đỏ-vàng trái (chữ chưa rõ); máy đếm số | → PH_003 straight | ✓ |
| 3 | PH_003 | F1 | chắc chắn | lobby | Bình chữa cháy; bảng thông báo vàng; lối thang máy xa | → PH_004 right | ✓ |
| 4 | PH_004 | F1 | chắc chắn | junction | Biển vàng-đỏ (text chưa rõ); nhóm nhân viên áo trắng | → PH_005 right | ✓ |
| 5 | PH_005 | F1 | chắc chắn | lobby | Kiosk sức khỏe đứng (trắng-đỏ, phải) | → PH_006 straight | ✓ |
| 6 | PH_006 | F1 | ước lượng | corridor | Thanh vịn inox 2 bên; cửa kính cuối; CCTV | → PH_007 straight | — |
| 7 | PH_007 | F1 | ước lượng | corridor | Thanh vịn inox; cửa kính (gần hơn PH_006) | → PH_008 straight | — |
| 8 | PH_008 | F1 | ước lượng | elevator_hall | 3 thang máy + biển "3"; TV tường trái | → PH_009 up_elevator ✱ | — |
| 9 | PH_009 | F2 | ước lượng | lobby | **Khoa Dược / Dept of Pharmacy** (biển rõ); sàn terrazzo | → PH_010 straight | — |
| 10 | PH_010 | F2 | ước lượng | corridor | Lan can kính (phải); EXIT nhỏ xa | → PH_011 straight | — |
| 11 | PH_011 | F2 | ước lượng | corridor | 3 cửa sổ lớn (trái); EXIT + bình chữa cháy xa | → PH_012 straight | — |
| 12 | PH_012 | F2 | **chắc chắn** | junction | **LỐI THOÁT/EXIT** ←; **lan can kính → khu chờ bên dưới**; CCTV | → PH_013 straight ✱ | ✓ |
| 13 | PH_013 | F2 ✱ | không xác định | corridor | Biển khoa backlit xanh lá (xa, chữ chưa rõ); dispenser khử trùng | → PH_014 straight | — |
| 14 | PH_014 | F2 ✱ | không xác định | corridor | Biển nâu-vàng (text chưa rõ); lan can kính phải | → PH_015 straight | — |
| 15 | PH_015 | F2 ✱ | không xác định | corridor | **Nhà Vệ Sinh / Honest Restroom**; bình chữa cháy + tủ báo cháy | cuối tuyến | — |

**✱ Ghi chú quan trọng:**
- PH_008→PH_009: Lối chuyển tầng chưa xác nhận (thang máy hay cầu thang). Biển "3" tại sảnh thang máy chưa rõ nghĩa (số lượng buồng? hay số tầng?).
- PH_012: **Bằng chứng mạnh nhất** về F2 — lan can kính nhìn xuống rõ khu chờ ghế inox và bệnh nhân ngồi ở tầng dưới.
- PH_013–015: floorId không xác định — có thể F2 tiếp hoặc F3. Không thấy chuyển tầng rõ ràng trong ảnh.

---

## 3. Phân tích sàn và cấu trúc

| Đặc điểm | PH_001–005 (F1 Sảnh) | PH_006–008 (F1 hành lang) | PH_009–012 (F2 terrazzo) | PH_013–015 (F2 hay F3) |
|---|---|---|---|---|
| Loại sàn | Marble trắng + thảm đen | Ceramic tile trắng | Terrazzo nâu-vàng | Trắng + dải terrazzo nâu viền |
| Trần | Cao (double height) | Thạch cao thấp | Thạch cao thấp | Thạch cao thấp |
| Thanh vịn | Không | Inox 2 bên | Một bên (gần lan can) | Inox 1 bên |
| Lan can kính | Không (nhìn từ dưới thấy) | Không | **Có** (PH_010–012) | Có (PH_014) |
| Chiều rộng | Rộng (sảnh) | Hẹp | Trung bình–rộng | Trung bình |

**Nhận xét:** Hành lang PH_006–008 (sàn trắng, hẹp, F1) và PH_009+ (sàn terrazzo/trắng-viền, F2) có thiết kế khác nhau rõ rệt, hỗ trợ giả thuyết chúng ở hai tầng khác nhau.

---

## 4. Bảng so sánh Tầng 1 / Tầng 2

> **Giới hạn:** Không thể xác định chính xác ranh giới F2/F3 từ 15 ảnh hiện có. Bảng dưới chỉ so sánh các đặc điểm quan sát được — chưa có ảnh khảo sát xác nhận F3.

| Đặc điểm | F2 (Tầng 1, PH_009–012) | F2 hay F3? (PH_013–015) | Khác biệt quan sát |
|---|---|---|---|
| Sàn | Terrazzo nâu-vàng | Trắng + dải viền nâu | Sàn khác nhau → có thể là 2 tầng khác nhau |
| Biển khoa | Khoa Dược (rõ) | Biển backlit xanh + biển nâu-vàng (chưa rõ tên) | Chưa đối chiếu được |
| Lan can | Có (PH_010-012) | Có (PH_014) | Không đủ để phân biệt tầng |
| Cảm biến | Không thấy rõ | Bình/tủ báo cháy (PH_015) | Không đặc trưng riêng |
| Kết luận | **Cần thêm ảnh F3 xác nhận** | **Không xác định** | Cần ảnh staircase hoặc biển tầng |

**Hành động cần làm:** Chụp thêm ảnh (a) biển "Tầng 1" / "Tầng 2" trên tường/cột, (b) cầu thang nối F2→F3, (c) màn hình thang máy khi mở cửa tại từng tầng.

---

## 5. Trạng thái ảnh theo tầng

| Tầng | floorId | Số ảnh | Trạng thái |
|---|---|---|---|
| Tầng trệt (Sảnh) | F1 | 8 (PH_001–008) | Ảnh có, cần xác nhận ranh giới PH_006–008 |
| Tầng 1 | F2 | 4–7 (PH_009–015) | Ảnh có, cần xác nhận PH_013–015 là F2 hay F3 |
| Tầng 2 | F3 | **0** | **Chưa có ảnh xác nhận** |

---

## 6. Bảng quyền riêng tư

| ID | Khuôn mặt | Thông tin BN | Màn hình/giấy tờ | Đề xuất |
|---|---|---|---|---|
| PH_001 | ✓ (2–3 nhân viên quầy, xa, mờ) | — | — | Làm mờ nếu phát hành công khai; đủ xa để tham chiếu nội bộ |
| PH_002 | ✓ (1–2 người xa, mờ) | — | — | Như PH_001 |
| PH_003 | ✓ (vài người ngồi, xa) | — | — | Như PH_001 |
| PH_004 | ✓ (nhóm nhân viên áo trắng cuối sảnh) | — | — | Làm mờ vùng nhân viên nếu cần |
| PH_005 | ✓ (2 người xa, mờ) | — | — | Như PH_001 |
| PH_006 | — | — | — | Không cần xử lý |
| PH_007 | — | — | — | Không cần xử lý |
| PH_008 | — | — | ✓ (TV màn hình, nội dung chưa đọc được) | Xác nhận nội dung TV; nếu có thông tin BN → làm mờ màn hình |
| PH_009–011 | — | — | — | Không cần xử lý |
| PH_012 | ✓ (1 người đeo khẩu trang đi; bệnh nhân ngồi chờ nhìn qua lan can) | — | — | Làm mờ nếu phát hành công khai; ảnh kích thước lớn nhất (610KB) |
| PH_013 | ✓ (1 người rất xa, mờ) | — | — | Không cần xử lý |
| PH_014–015 | — | — | — | Không cần xử lý |

**Nguyên tắc:** Không sửa ảnh gốc trong phiên này. Không commit ảnh vào repo. Khi phát hành public cần làm mờ khuôn mặt tại PH_001–005, PH_012.

---

## 7. Câu hỏi cần xác nhận (ưu tiên giảm dần)

| # | Câu hỏi | Ảnh liên quan | Ảnh hưởng |
|---|---|---|---|
| Q1 | **Ranh giới F2/F3:** PH_013–015 ở Tầng 1 hay Tầng 2? Cần ảnh cầu thang/biển tầng xác nhận | PH_013–015 | floorId; có hay chưa có ảnh T2 |
| Q2 | **Biển "3" tại sảnh thang máy (PH_008):** nghĩa là gì? (3 buồng? Tầng 3? Khu 3?) | PH_008 | Đặt tên elevator_hall; kiến trúc |
| Q3 | **Lối chuyển PH_008→PH_009:** đi qua thang máy, cầu thang hay lối đi nối? Cần ảnh bổ sung | PH_008, PH_009 | transition type; tính liên tục tuyến |
| Q4 | **PH_006–008 thuộc F1 hay F2?** Sàn ceramic tile khác marble sảnh, có thể đã lên tầng | PH_006–008 | floorId; 4 hay 8 ảnh F1 |
| Q5 | **Text biển vàng-đỏ (PH_004) và biển vàng (PH_003):** tên đầy đủ là gì? | PH_003, PH_004 | landmark hoàn chỉnh |
| Q6 | **Biển khoa backlit xanh (PH_013) và biển nâu-vàng (PH_014):** tên đầy đủ | PH_013, PH_014 | tên landmark, liên kết room |
| Q7 | **"Honest Restroom" (PH_015):** đây là tên thật hay OCR/đọc nhầm biển? | PH_015 | landmark text |
| Q8 | **Ảnh T2 (F3):** cần chụp thêm để hoàn thành tuyến Sảnh→T1→T2 | (chưa có) | 0 ảnh F3 hiện tại |
| Q9 | **File ảnh gốc:** có thể di chuyển vào `assets/survey-photos/` không? Tên file đề xuất: `001.jpg`–`015.jpg` | Tất cả | `file` field trong JSON |
| Q10 | **Nội dung TV (PH_008):** có hiển thị thông tin bệnh nhân không? | PH_008 | privacy screensOrDocs |

---

## 8. Bước tiếp theo (sau khi xác nhận)

1. **[USER]** Trả lời Q1–Q4 (ranh giới tầng, biển "3", lối chuyển).
2. **[USER]** Chụp thêm ảnh F3 (Tầng 2): cầu thang F2→F3, hành lang F3, biển "Tầng 2" trên tường.
3. **[USER]** Di chuyển file ảnh vào `assets/survey-photos/` và thêm vào `.gitignore` nếu có mặt người.
4. **[AG]** Cập nhật floorId cho PH_006–015 sau khi xác nhận.
5. **[AG]** Bổ sung text landmark còn thiếu (Q5, Q6, Q7).
6. **[CHAT]** Quyết định schema mở rộng khi có sơ đồ mặt bằng (thêm x, z, yawDeg).

---

*Nguồn ảnh: khảo sát thực địa BV Quân y 7A, thứ tự theo tên file (không có EXIF). Không commit ảnh gốc. Không upload lên dịch vụ ngoài.*
