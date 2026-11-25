# HARDWARE – Thiết bị phần cứng

> **Bản nháp – 2026-10-26.** Mọi thông số phải đối chiếu với PDF gốc và đo thực tế trước khi triển khai. Dòng ghi "Cần xác nhận" chưa được kiểm chứng độc lập.

---

## 1. Bảng kiểm kê thiết bị hiện có

| Thiết bị | Hãng | Model / SKU | Số lượng | Vai trò | Nguồn tài liệu | Trạng thái |
|---|---|---|---|---|---|---|
| BLE Sensor Beacon V1.0 (nhãn in trên bo) | DFRobot (nhãn "Gravity") | TEL0149 – **Cần xác nhận** (đối chiếu mã in trên bo/hộp) | 1 | Beacon điểm đến; phát BLE advertisement để app nhận biết phòng | [wiki.dfrobot.com/tel0149](https://wiki.dfrobot.com/tel0149/) | Nhận được, chưa cấu hình |
| CP2102 MODULES USB TO TTL 01 (nhãn in) | Không rõ hãng | CP2102 USB-TTL | 1 | Cổng UART để cấu hình bo beacon bằng NanoBeaconConfigTool | – | Nhận được, chưa kiểm điện áp |

---

## 2. Thông số bo beacon (theo TEL0149 – mỗi dòng có nguồn)

| Thông số | Giá trị | Nguồn |
|---|---|---|
| Chuẩn BLE | BLE 5.3 (mục tính năng) / "BLE 5" (mục 4.12) — datasheet nêu cả hai | Datasheet chip IN100 `TEL0149_gravity-in100-ble-sensor-data-broadcasting-module_datasheet_V1.0.pdf` |
| Định dạng phát hỗ trợ | iBeacon, Eddystone, AltBeacon, tùy chỉnh; tối đa 3 bộ dữ liệu phát | Datasheet chip IN100 |
| Công suất phát tối đa | +5 dBm | Datasheet chip IN100 |
| Công suất phát tối thiểu | −50 dBm | Datasheet chip IN100 |
| Bước nhảy công suất phát | Cần xác nhận (xem công cụ NanoBeaconConfigTool) | – |
| Băng tần | 2.4 GHz | [wiki.dfrobot.com/tel0149](https://wiki.dfrobot.com/tel0149/) |
| Điều chế | GFSK | Datasheet chip IN100 |
| Tốc độ bit | 1 Mbps hoặc 125 kbps | Datasheet chip IN100 |
| Chế độ phát | Chỉ phát (non-connected advertising); không nhận | Datasheet chip IN100 |
| Chu kỳ phát | Cấu hình được; ví dụ hãng: 1 giây. Dải cho phép: Cần xác nhận | [wiki.dfrobot.com/tel0149/docs/22130](https://wiki.dfrobot.com/tel0149/docs/22130) |
| Địa chỉ phát | Cố định hoặc ngẫu nhiên/resolvable; Cần xác nhận cách bật | Datasheet chip IN100 |
| Kích thước PCB | 27 × 33.5 mm; lỗ gắn trong 3.1 mm / ngoài 6 mm | [wiki.dfrobot.com/tel0149](https://wiki.dfrobot.com/tel0149/) |
| UART (cấu hình) | 115200 baud mặc định | Datasheet chip IN100 |
| Bộ nhớ eFuse OTP | 4 Kbit, ghi một lần | Datasheet chip IN100 |
| SRAM | 4 KB (mất khi mất điện) | Datasheet chip IN100 |
| Dòng tiêu thụ – phát 0 dBm | 9.1 mA (chip, 3.0 V, 25 °C) | Datasheet chip IN100 |
| Dòng tiêu thụ – phát +5 dBm | 13.8 mA (chip, 3.0 V, 25 °C) | Datasheet chip IN100 |
| Dòng tiêu thụ – ngủ | 0.625 µA (chip) | Datasheet chip IN100 |
| Dòng trung bình ở Eddystone TLM | < 2 mA (theo wiki bo, chưa kiểm) | [wiki.dfrobot.com/tel0149](https://wiki.dfrobot.com/tel0149/) |
| Tuổi thọ pin | Cần xác nhận (phụ thuộc dung lượng pin, chu kỳ phát, công suất) | – |
| Tầm phát trong tòa nhà | Không có trong tài liệu hãng; phải đo tại hiện trường | – |

---

## 3. Cổng chân P1 (cấu hình UART)

**Thứ tự chân theo nhãn in trên bo** (trái → phải khi nhìn mặt trên):

```
3V3 | RXD | TXD | GND
```

**Điện áp logic:** 3.3 V (wiki yêu cầu cáp USB-TTL 3.3 V).

**Nối với cáp USB-TTL (CP2102):** Cần xác nhận chiều TX↔RX theo hình đấu nối chính thức của hãng tại [wiki.dfrobot.com/tel0149/docs/22130](https://wiki.dfrobot.com/tel0149/docs/22130). Thông thường TX của bo nối vào RX của cáp và ngược lại, nhưng **không đoán — phải nhìn hình sơ đồ**.

**Điện áp cáp CP2102 hiện có:** Cần xác nhận (xem nhãn cáp hoặc datasheet CP2102 module).

---

## 4. Cổng nguồn BAT_IN (P2)

- 2 chân: BAT_IN và GND (theo schematic — tên chân nào ở vị trí nào: Cần xác nhận nhìn hình schematic).
- Mạch điều áp U1 (RT9080): đầu vào BAT_IN → đầu ra 3V3 (cấp cho chip IN100).
- **Không có đế pin cúc áo trên bo** (theo ghi chú schematic).
- Cách cấp nguồn khi gắn tường: Cần xác nhận.

---

## 5. Run in RAM và Burn/Program

> ⚠️ **Đọc kỹ trước khi thao tác với thiết bị thật.**

### Run in RAM
- Nạp cấu hình vào SRAM (4 KB). Cấu hình **mất khi mất điện hoặc reset**.
- Dùng để thử nghiệm nhiều lần mà không tiêu tốn bộ nhớ eFuse.
- **Trước lần Run in RAM thứ 2 trở đi:** ngắt hoàn toàn nguồn (rút cáp nguồn, đợi vài giây, cắm lại) — theo hướng dẫn từ FAQ dòng TEL0168 (anh em cùng chip IN100). Cần xác nhận có áp dụng cho TEL0149 không, nhưng khuyến nghị làm theo để an toàn.

### Burn / Program
- Ghi cấu hình vào **eFuse OTP 4 Kbit**. eFuse chỉ đổi bit theo một chiều (0 → 1) và **không đảo ngược được**.
- Sau khi Burn: cấu hình UUID/Major/Minor/chu kỳ phát/công suất **cố định vĩnh viễn**.
- **Phải có văn bản chốt cấu hình** (UUID, Major, Minor, chu kỳ phát, công suất) trước khi Burn. Xem thêm: CLAUDE.md quy tắc 10, ROADMAP.md Phase 0 bước 4f.

### Công cụ cấu hình
- **NanoBeaconConfigTool** (NanoBeaconConfig.exe): tải tại [inplay-tech.com/config-tool](https://inplay-tech.com/config-tool/).
- Hệ điều hành hỗ trợ: `.exe` gợi ý Windows; Cần xác nhận chính thức.
- Quy trình: Probe → chọn cổng COM → Connect → cấu hình các tham số → Run in RAM (thử) hoặc Burn/Program (ghi vĩnh viễn).

---

## 6. Mâu thuẫn cần xác nhận

| Mục | Nguồn A | Nguồn B | Nguồn C | Ghi chú |
|---|---|---|---|---|
| Điện áp cấp vào bo | 1.2–5.5 V ([wiki DFRobot](https://wiki.dfrobot.com/tel0149/)) | 3.3–5.5 V ([Core Electronics](https://core-electronics.com.au/gravity-ble-sensor-beacon-pack-5-pcs.html)) | Chip IN100: 1.1–3.6 V (bo có LDO RT9080, nên điện áp vào bo ≠ điện áp chip) | Cần đối chiếu schematic để biết dải an toàn thực tế của bo |
| Phiên bản datasheet | Tên file trên wiki: `_V1.0.pdf` | Nội dung file datasheet tự ghi: V1.3 | – | Cần xác nhận phiên bản đang dùng là V1.0 hay V1.3 |

---

## 7. Chưa xác minh

1. **SKU thực tế của bo:** đối chiếu mã in trên bo hoặc hộp với "TEL0149".
2. **Số lượng beacon cần:** tương ứng số phòng/điểm đến trong bệnh viện (Cần xác nhận).
3. **Cách cấp nguồn khi gắn tường:** pin, nguồn USB, hay cáp điện — Cần xác nhận.
4. **Tầm phát thực tế trong tòa nhà:** phải đo bằng bench test (xem HUONG_DAN.md mục 7).
5. **Báo mức pin:** chưa tìm thấy bằng chứng bo phát gói pin trong advertisement — Cần xác nhận.
6. **Hành vi bo chưa Burn khi cấp điện:** có tự phát tín hiệu không, phát định dạng gì — Cần xác nhận.
7. **Chu kỳ phát cho phép:** dải tối thiểu/tối đa — Cần xác nhận qua NanoBeaconConfigTool.
8. **Điện áp cáp CP2102 hiện có:** xem nhãn hoặc datasheet module.
9. **Chiều nối TX↔RX giữa bo và cáp:** xem hình đấu nối trên wiki.
10. **Hệ điều hành máy tính chạy NanoBeaconConfigTool:** Cần xác nhận.
11. **Thiết bị Android:** đời máy và phiên bản OS — Cần xác nhận.
12. **Thiết bị iOS:** có không, đời máy, phiên bản OS — Cần xác nhận.

---

## 8. Tài liệu cần đọc

| Tài liệu | Đường dẫn / URL | Trạng thái |
|---|---|---|
| Datasheet chip IN100 | `assets/hardware/TEL0149_gravity-in100-ble-sensor-data-broadcasting-module_datasheet_V1.0.pdf` | Đã tải (2026-10-26) |
| Schematic bo TEL0149 | `assets/hardware/TEL0149_gravity-in100-ble-sensor-data-broadcasting-module_schematics_V1.0.pdf` | Đã tải (2026-10-26) |
| Dimension bo TEL0149 | `assets/hardware/TEL0149_gravity-in100-ble-sensor-data-broadcasting-module_dimension_V1.0.pdf` | Đã tải (2026-10-26) |
| Wiki chính + thông số | [wiki.dfrobot.com/tel0149](https://wiki.dfrobot.com/tel0149/) | Đã tra (2026-10-26) |
| Hướng dẫn cấu hình + Burn | [wiki.dfrobot.com/tel0149/docs/22130](https://wiki.dfrobot.com/tel0149/docs/22130) | Đã tra (2026-10-26) |

---

## 9. Kết quả bench test RSSI thực tế (TEL0149 — Run in RAM)

> **Chưa có dữ liệu.** Chủ dự án điền sau khi đo bằng `bench/index.html` → mục "7. Ghi mẫu đo & xuất CSV" → nút "Xuất CSV" → lưu vào `bench/measurements/`.
> Quy trình đo chi tiết: xem [HUONG_DAN.md](../HUONG_DAN.md) mục 7 và 9.
> Script phân tích CSV: `node tools/suggest-thresholds.mjs bench/measurements/<file>.csv`

| Khoảng cách (m) | RSSI trung bình (dBm) | Độ lệch chuẩn (dBm) | Số mẫu (≥60 giây) | Điều kiện | Ghi chú |
|---|---|---|---|---|---|
| 0.5 | Cần đo | Cần đo | Cần đo | Không vật cản | |
| 0.5 | Cần đo | Cần đo | Cần đo | Có vật cản | |
| 1 | Cần đo | Cần đo | Cần đo | Không vật cản | |
| 1 | Cần đo | Cần đo | Cần đo | Có vật cản | |
| 2 | Cần đo | Cần đo | Cần đo | Không vật cản | |
| 2 | Cần đo | Cần đo | Cần đo | Có vật cản | |
| 4 | Cần đo | Cần đo | Cần đo | Không vật cản | |
| 4 | Cần đo | Cần đo | Cần đo | Có vật cản | |
| 8 | Cần đo | Cần đo | Cần đo | Không vật cản | |
| 8 | Cần đo | Cần đo | Cần đo | Có vật cản | |

**Tham số RoomResolver hiện tại (chưa hiệu chỉnh — xem `bench/room-resolver.js` `DEFAULT_PARAMS`):**

| Tham số | Giá trị hiện tại | Ghi chú |
|---|---|---|
| `rssiThreshold` | -80 dBm | Ngưỡng tối thiểu để tính (Cần xác nhận bằng đo thực) |
| `hysteresisMargin` | 5 dBm | Beacon mạnh nhất phải hơn thứ hai ≥ N dBm (Cần xác nhận) |
| `sampleTTL_ms` | 10 000 ms | Mẫu hết hạn sau 10 giây mất tín hiệu (Cần xác nhận) |
| `windowSize` | 5 mẫu | Số mẫu trung bình trượt (Cần xác nhận) |
| `minConsecutive` | 3 lần | Phải đồng thuận liên tiếp trước khi kết luận (Cần xác nhận) |

Sau khi đo, chạy `node tools/suggest-thresholds.mjs bench/measurements/<file>.csv` để xem đề xuất ngưỡng.
| Ghi chú tóm tắt từ datasheet | `assets/hardware/TEL0149_ghi_chu_datasheet.md` | Có sẵn |
| Nguồn tài liệu đầy đủ | `assets/hardware/TEL0149_nguon_tai_lieu.md` | Có sẵn |
