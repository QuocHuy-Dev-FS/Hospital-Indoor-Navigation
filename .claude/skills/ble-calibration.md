---
name: ble-calibration
description: Quy trình đo và hiệu chỉnh tín hiệu RSSI beacon BLE tại hiện trường cho dự án Hospital Indoor Navigation. Bám HUONG_DAN.md mục 2 và docs/DATA_MODEL.md CalibrationRecord. Mọi ngưỡng ghi "Cần xác nhận". Không chứa UUID/Major/Minor thật.
---

# Skill: ble-calibration

> **Mọi ngưỡng và tham số số trong skill này đều ghi "Cần xác nhận".**
> Phải đo thực tế tại hiện trường Bệnh viện Quân y 7A; không dùng giá trị mặc định mà không kiểm chứng.
> Skill KHÔNG chứa UUID/Major/Minor thật của beacon.
> Script mẫu KHÔNG tự cài package, KHÔNG tải mã từ mạng.

## Mục tiêu
Hướng dẫn đo RSSI tham chiếu, lập bảng RSSI–khoảng cách, ghi `CalibrationRecord` vào `data/calibration/`, và ước tính sai số định vị. Kết quả dùng cho Phase 5 (định vị BLE).

---

## Chuẩn bị trước khi đo

**Thiết bị:**
- Điện thoại có app quét BLE (ví dụ nRF Connect trên iOS/Android).
  - iOS: bật Bluetooth + Location (quyền "While Using" tối thiểu).
  - Android: bật Bluetooth + Location (Android 12+ cần quyền `BLUETOOTH_SCAN`).
- Thước laser hoặc thước dây (tối thiểu 8 m).
- Bảng ghi tay (giấy hoặc app ghi chú): beacon ID nhãn dán (ví dụ `F1-B01`), tầng, vị trí, khoảng cách, RSSI, thời điểm, điều kiện.
- Sơ đồ mặt bằng in ra để đánh dấu điểm đo.

**Trước khi ra hiện trường:**
- Xác nhận beacon đã gắn và cấp nguồn (xem HUONG_DAN.md mục 1).
- Ghi nhận danh sách `beaconId` nhãn dán (KHÔNG ghi UUID/Major/Minor vào bảng nếu được coi là nhạy cảm).
- Xin phép bệnh viện cho đo tại khu vực hạn chế nếu cần; không đo gần thiết bị y tế đang hoạt động (máy MRI, X-quang đang chạy).

---

## Quy trình đo chuẩn (bám HUONG_DAN.md mục 2)

### Bước 1: Đo RSSI tham chiếu tại 1 m

1. Đứng cách beacon **1 m** chính xác (đo bằng thước, không ước lượng).
2. Giữ điện thoại ở độ cao tay cầm bình thường (≈ 1–1,2 m so với sàn), không che chắn.
3. Đọc RSSI liên tục trong **30–60 giây**, ghi ≥ 20 mẫu.
4. Tính `rssiMean = trung bình` và `rssiStd = độ lệch chuẩn`.
5. Giá trị này = `rssiAt1m` trong bản ghi `Beacon` → cập nhật `data/beacons.json` (field `rssiAt1m`).

### Bước 2: Lập bảng RSSI–khoảng cách

Đo tại các khoảng cách (điều chỉnh theo hành lang thực tế):
- 1 m, 2 m, 4 m, 8 m
- Khoảng xa nhất ≤ khoảng cách thực đến beacon kề (tránh đo qua vật cản không điển hình)

Với mỗi khoảng cách: ≥ 3 lần đo × ≥ 20 mẫu/lần → ghi trung bình + độ lệch chuẩn.

### Bước 3: Đo trong nhiều điều kiện môi trường

| Điều kiện | Ghi chú |
|---|---|
| Hành lang trống (giờ vắng, sáng sớm) | Baseline |
| Hành lang đông người (giờ cao điểm) | Cơ thể người hấp thụ 2,4 GHz đáng kể |
| Sát tường dày / phòng chì (X-quang) | Nếu beacon ở gần – đo ngoài phòng |
| Gần thang máy | Kim loại gây nhiễu cao |
| Khác (ghi cụ thể) | Ví dụ: phòng có nhiều giường sắt, kho thiết bị |

**Không đo** trong phòng MRI hoặc phòng có thiết bị đang phát xạ mà chưa được phép của bệnh viện.

---

## Ghi dữ liệu CalibrationRecord

Mỗi lần đo (một beacon, một khoảng cách, một điều kiện) = một bản ghi JSON.
Lưu tại `data/calibration/F<tầng>_B<số>_<date>.json` (một file nhiều bản ghi):

```json
[
  {
    "beaconId": "F1_B01",
    "distance_m": 1.0,
    "rssiMean": null,
    "rssiStd": null,
    "samples": 30,
    "date": "YYYY-MM-DD",
    "measuredBy": null,
    "condition": "corridor_empty",
    "notes": ""
  }
]
```

**Quy tắc:**
- `beaconId`: dùng ID nhãn dán (ví dụ `F1_B01`), khớp với `data/beacons.json`.
- `rssiMean`, `rssiStd`: điền từ số đo thực; KHÔNG bịa hoặc copy từ datasheet.
- UUID/Major/Minor: KHÔNG ghi vào file này nếu được coi là nhạy cảm.
- `condition` ∈ `corridor_empty`, `corridor_busy`, `near_wall`, `near_elevator`, `near_xray_room`, hoặc mô tả cụ thể.

---

## Bộ lọc RSSI (gợi ý – chốt ở Phase 5)

Các phương án (chưa cài/chạy; chờ Phase 5):

| Bộ lọc | Phù hợp | Tham số cần xác nhận |
|---|---|---|
| Trung bình trượt | Đơn giản, ít tài nguyên | Window size (đề xuất 5–10 mẫu) |
| Kalman filter | Mượt hơn, xử lý nhiễu tốt hơn | Q (nhiễu hệ thống), R (nhiễu đo) |
| Loại ngoại lệ (outlier rejection) | Loại đỉnh nhiễu cứng | Ngưỡng ± k×σ (đề xuất k=2) |

Mọi tham số trên: **Cần xác nhận** sau khi có dữ liệu thực từ hiện trường.

---

## Ước tính sai số định vị (sau khi có đủ dữ liệu)

1. Dùng mô hình log-distance: `RSSI(d) = rssiAt1m - 10·n·log10(d)` với `n` = path loss exponent (**Cần xác nhận**, thường 2–4 trong nhà).
2. Tính `d_est` từ RSSI đo được; sai số = `|d_est - d_thực|`.
3. Ghi kết quả vào bảng:

```json
{
  "beaconId": "F1_B01",
  "pathLossExponent": null,
  "errorMean_m": null,
  "errorMedian_m": null,
  "errorMax_m": null,
  "conditionBreakdown": {}
}
```

4. Mục tiêu sai số: **Cần xác nhận** (đề xuất ≤ 3 m / đúng phòng; chốt chính thức ở Phase 0 và Phase 9).
5. Nếu sai số lớn → tăng số beacon, điều chỉnh vị trí gắn, thêm điểm đo, điều chỉnh tham số bộ lọc.

---

## Màn hình hiệu chỉnh kỹ thuật viên

Sẽ có ở **Phase 5**. Cho tới lúc đó: ghi chép thủ công theo mẫu bên trên, lưu vào `data/calibration/`.

---

## Báo cáo sau khi đo

Ghi vào `PROJECT_STATUS.md`:
- Số beacon đã đo, tầng, ngày đo
- Phạm vi `rssiAt1m` (ví dụ "-65 đến -72 dBm") – KHÔNG ghi UUID
- Điều kiện đo đã thực hiện
- Sai số ước tính và so sánh với mục tiêu "Cần xác nhận"
- Bất thường phát hiện (beacon yếu bất thường, vùng nhiễu cao) → ghi vào "Câu hỏi mở" ROADMAP.md và mang về Claude Chat
