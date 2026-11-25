# TEL0149 – Nguồn tài liệu chính thức (DFRobot)

Tra cứu ngày 2026-10-26. Thiết bị: Gravity: IN100 BLE Sensor Data Broadcasting Module (SKU TEL0149).
Việc bo của chủ dự án (nhãn "BLE Sensor Beacon v1.0") đúng là TEL0149: **Cần xác nhận** (đối chiếu mã in trên bo/hộp).

## Trang wiki
| Nội dung | URL |
|---|---|
| Trang chính, thông số, sơ đồ chân | https://wiki.dfrobot.com/tel0149/ |
| Cấu hình và Burn (Run in RAM / Burn-Program) | https://wiki.dfrobot.com/tel0149/docs/22130 |
| Ví dụ đọc dữ liệu bằng nRF Connect | https://wiki.dfrobot.com/tel0149/docs/22129 |
| Ví dụ đọc dữ liệu bằng ESP32 | https://wiki.dfrobot.com/tel0149/docs/22128 |
| Reference | https://wiki.dfrobot.com/tel0149/docs/22127 |
| Công cụ cấu hình NanoBeaconConfigTool | https://inplay-tech.com/config-tool/ |

## File PDF của hãng (CẦN CHỦ DỰ ÁN TỰ TẢI)
Môi trường làm việc của Claude không tải được file từ dfrobot.com (bị chặn mạng, lỗi 403), nên 3 file gốc dưới đây **chưa có trong thư mục này**. Bấm link, lưu vào thư mục `assets/hardware/` với đúng tên file:

| Tài liệu | URL | Trạng thái |
|---|---|---|
| Datasheet | https://dfimg.dfrobot.com/wiki/21083/TEL0149_gravity-in100-ble-sensor-data-broadcasting-module_datasheet_V1.0.pdf | Đã tải (2026-10-26, 1.85 MB, %PDF xác nhận) |
| Schematic | https://dfimg.dfrobot.com/wiki/21083/TEL0149_gravity-in100-ble-sensor-data-broadcasting-module_schematics_V1.0.pdf | Đã tải (2026-10-26, 55 KB, %PDF xác nhận) |
| Dimension | https://dfimg.dfrobot.com/wiki/21083/TEL0149_gravity-in100-ble-sensor-data-broadcasting-module_dimension_V1.0.pdf | Đã tải (2026-10-26, 56 KB, %PDF xác nhận) |

Ghi chú nội dung đã đọc được từ datasheet và schematic nằm ở `TEL0149_ghi_chu_datasheet.md`. Đó là bản tóm tắt qua công cụ đọc web, **không thay thế PDF gốc**.

## Nguồn tham khảo phụ (bên bán lẻ, độ tin cậy thấp hơn tài liệu hãng)
- https://core-electronics.com.au/gravity-ble-sensor-beacon-pack-5-pcs.html.md (ghi điện áp 3.3–5.5 V, khác wiki)
- https://eu.robotshop.com/products/dfrobot-gravity-ble-sensor-beacon-pack-5x

## Dòng liên quan (không dùng làm dữ kiện cho TEL0149)
- TEL0168 Fermion: BLE Sensor Beacon (anh em, cùng chip IN100): https://wiki.dfrobot.com/_SKU_TEL0168_Fermion_BLE_Sensor_Beacon
- FAQ TEL0168 (quy trình Run in RAM lần 2): https://www.dfrobot.com/forum/topic/334032
- Mã TEL0140 là công tắc không dây 433 MHz, KHÔNG phải beacon.
