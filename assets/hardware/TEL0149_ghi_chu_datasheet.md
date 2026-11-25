# TEL0149 – Ghi chú từ datasheet chip IN100 và schematic bo

Ngày tra: 2026-10-26.
Nguồn: datasheet và schematic trên wiki DFRobot (xem `TEL0149_nguon_tai_lieu.md`).

**Lưu ý độ tin cậy**
- Nội dung được đọc qua công cụ đọc web rồi tóm tắt, không phải bản sao nguyên văn. Mọi con số dùng cho quyết định phần cứng phải đối chiếu lại với PDF gốc.
- File datasheet đọc được tự ghi "V1.3" trong khi tên file trên wiki là "V1.0": **Cần xác nhận** phiên bản.
- Datasheet là của **chip IN100**, không phải của cả bo. Bo TEL0149 có thêm mạch cấp nguồn (LDO), nên điện áp cấp vào bo khác điện áp chân chip.

## 1. Điện áp (chip IN100 – datasheet)
- VCC chip: tối thiểu 1.1 V, thường 1.5 V, tối đa 3.6 V; mức tối đa tuyệt đối −0.3 đến 3.9 V.
- Chân GPIO: mức logic theo VCC (VIH ≥ 0.7×VCC, VIL ≤ 0.3×VCC).
- Điện áp ADC đầu vào tối đa: min(2 V, VCC).

## 2. Điện áp cấp vào bo (schematic và wiki)
- Schematic: mạch điều áp U1 (RT9080), đầu vào net BAT_IN, đầu ra net 3V3. Đầu nối nguồn 2 chân P2 (BAT_IN, GND); chưa rõ chân nào là chân nào: **Cần xác nhận**.
- Schematic: không thấy đế pin cúc áo.
- Wiki: dải cấp điện 1.2–5.5 V. Trang Core Electronics: 3.3–5.5 V. **Mâu thuẫn, Cần xác nhận.**
- Cách cấp nguồn thực tế khi gắn tường: **Cần xác nhận.**

## 3. Cổng cấu hình (schematic – header P1, 4 chân)
- Nhãn trên schematic: TX, RX, 3V3_1, GND (khớp 4 chân 3V3/RXD/TXD/GND in trên bo).
- Thứ tự chân và chân nào là chân nào: **Cần xác nhận** (văn bản schematic bị đảo thứ tự khi trích). Phải nhìn hình sơ đồ trong wiki hoặc PDF schematic.
- Nối chéo TX↔RX giữa bo và cáp: **Cần xác nhận** theo hình đấu nối của hãng.
- Cáp USB-TTL phải là mức 3.3 V (wiki). Điện áp thực của cáp "CP2102 MODULES USB TO TTL 01": **Cần xác nhận**.
- Chip dùng UART mặc định 115200 baud (datasheet). Công cụ cấu hình tự xử lý kết nối.

## 4. Bộ nhớ và ý nghĩa Run in RAM / Burn (datasheet)
- eFuse OTP 4 Kbit, chỉ ghi một lần (bit chỉ đổi theo một chiều 0→1). Đây là lý do "Burn/Program" **không đảo ngược**.
- SRAM 4 KB. "Run in RAM" nạp cấu hình vào SRAM nên mất khi mất điện (suy luận từ wiki; datasheet không dùng chữ "Run in RAM").
- Bo chưa Burn có tự phát tín hiệu khi cấp điện hay không: **Cần xác nhận**.

## 5. RF và chế độ phát (datasheet)
- BLE 5.3 (mục tính năng) / "BLE 5" (mục 4.12): datasheet nêu cả hai.
- Công suất phát tối đa +5 dBm, tối thiểu −50 dBm (mức công suất có thể chỉnh được trong công cụ: Cần xác nhận mức bước).
- Điều chế GFSK, băng 2.4 GHz, 1 Mbps hoặc 125 kbps.
- Chỉ phát không kết nối (non-connected advertising); không có chức năng nhận. Phù hợp vai trò beacon.
- Định dạng: iBeacon, Eddystone, AltBeacon, tùy chỉnh; tối đa 3 bộ dữ liệu phát.
- Chu kỳ phát cấu hình được (ví dụ của hãng: 1 giây). Dải giá trị cho phép: **Cần xác nhận**.
- Địa chỉ phát: cố định hoặc ngẫu nhiên/resolvable (có bật được: **Cần xác nhận** với công cụ cấu hình).
- Tầm phát thực tế trong tòa nhà: **Không có trong tài liệu**, phải đo tại hiện trường (bench test).

## 6. Dòng tiêu thụ (chip, 3.0 V, 25 °C)
- Phát 0 dBm: 9.1 mA; phát +5 dBm: 13.8 mA; ngủ: 0.625 µA.
- Dòng trung bình theo chu kỳ phát và loại pin: **Cần xác nhận** (không tính được từ dữ liệu này nếu chưa biết chu kỳ và cấu hình).
- Wiki bo ghi dưới 2 mA ở chế độ Eddystone TLM.

## 7. Cảm biến ADC
- ADC 11 bit trên chân MGPIO5 (kênh 1) cho đầu vào cảm biến. Dự án beacon dẫn đường không dùng đến; cứ để tắt, đừng nối cảm biến.

## 8. Khác
- Wiki khuyến nghị đặt hai tham số crystal capacitance về 12 khi cấu hình.
- Chưa tìm thấy chỗ nào nói bo báo mức pin qua gói phát: **Cần xác nhận**.
- File Dimension chỉ ra nhãn linh kiện, không đọc được kích thước. Dùng thông số wiki: PCB 27 × 33.5 mm, lỗ gắn trong 3.1 mm / ngoài 6 mm.
