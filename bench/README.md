# Bench – Công cụ kiểm tra Beacon BLE

> Phiên bản: 2026-10-26 · Dữ liệu tổng hợp (synthetic) khi dùng nguồn giả lập.
> Nguồn thật có mã nhưng **chưa kiểm chứng với phần cứng** (beacon chưa xác nhận phát gói iBeacon).

## Mục đích

Công cụ chạy trên laptop (trình duyệt, không cần cài đặt) để:
1. Quét gói BLE thật (nếu trình duyệt hỗ trợ) hoặc phát gói giả lập theo kịch bản.
2. Phân tích gói: iBeacon, Eddystone, gói không xác định.
3. Phân giải beacon → phòng với làm mượt RSSI, lọc IQR, hysteresis.
4. Ghi và xuất dữ liệu bench test thực tế (CSV).

## Cách chạy

### Cách 1: dùng lệnh dev của dự án (khuyến nghị)

```bash
npm run dev
```

Sau đó mở: **http://localhost:5173/bench/index.html**

### Cách 2: Python HTTP server (nếu không dùng Vite)

```bash
python -m http.server 8080
```

Sau đó mở: **http://localhost:8080/bench/index.html**

> **Lưu ý:** Trang phải mở qua `http://localhost` (hoặc HTTPS) để Web Bluetooth hoạt động.
> Mở trực tiếp file `file:///` sẽ không quét được BLE thật.

## Bật Web Bluetooth trong Chrome/Cốc Cốc/Edge

### Chrome / Edge

1. Mở `chrome://flags/#enable-experimental-web-platform-features`
2. Bật "Experimental Web Platform features"
3. Khởi động lại trình duyệt

### Cốc Cốc

Cốc Cốc dựa trên Chromium — **Cần xác nhận** phiên bản và mức hỗ trợ Web Bluetooth.
Thử: `coccoc://flags/#enable-experimental-web-platform-features` (nếu có).
Hoặc dùng Chrome/Edge làm phương án thay thế.

## Giới hạn đã biết

| Giới hạn | Ghi chú |
|---|---|
| iOS Safari | Không hỗ trợ Web Bluetooth — không chạy được nguồn thật |
| iPhone | Dùng làm thiết bị quét (nRF Connect) chứ không chạy bench |
| Windows | Laptop có thể tự phát gói quảng bá BLE của Windows — sẽ xuất hiện trong danh sách; lọc theo UUID/Major/Minor |
| requestLEScan | Tính năng thử nghiệm, có thể bị ẩn sau cờ |
| watchAdvertisements | Thiết bị chỉ phát (non-connectable) có thể không hiện trong hộp thoại chọn — **Cần xác nhận** |
| MAC address | Trình duyệt không cung cấp MAC → không hiển thị trong bench |

## Bộ phân giải beacon → phòng (room-resolver.js)

Dựa theo giả thuyết proximity/zone (ARCHITECTURE.md mục 9).

**Tham số mặc định** — tất cả **Cần xác nhận bằng đo thực**:

| Tham số | Giá trị mặc định | Ý nghĩa |
|---|---|---|
| `windowSize` | 5 | Số mẫu trung bình trượt |
| `iqrOutlierFactor` | 1.5 | Hệ số IQR loại ngoại lai |
| `sampleTTL_ms` | 10 000 | Thời gian hết hạn mẫu (ms) |
| `rssiThreshold` | -80 dBm | Ngưỡng RSSI tối thiểu |
| `hysteresisMargin` | 5 dBm | Beacon mạnh nhất phải hơn #2 ít nhất N dBm |
| `minConsecutive` | 3 | Số lần đọc liên tiếp trước khi kết luận |

> Kết quả chỉ đúng cho điều kiện đo thực tế. Không cam kết sai số nếu chưa hiệu chỉnh.

## Tài liệu tham khảo Web Bluetooth

- Chrome Web Bluetooth Spec (W3C/WICG):
  - requestLEScan: https://webbluetoothcg.github.io/web-bluetooth/scanning.html
  - requestDevice + watchAdvertisements: https://webbluetoothcg.github.io/web-bluetooth/#dom-bluetoothdevice-watchadvertisements
  - optionalManufacturerData: https://webbluetoothcg.github.io/web-bluetooth/#dom-requestdeviceoptions-optionalmanufacturerdata
- Chrome platform status: https://chromestatus.com/feature/5753808971415552
- Điều kiện bảo mật (HTTPS/localhost): https://developer.chrome.com/docs/capabilities/bluetooth

> **Lưu ý:** Các URL trên là tài liệu chính thức tại thời điểm viết (2026-10-26).
> Cốc Cốc: không tìm thấy tài liệu riêng về Web Bluetooth — **Cần xác nhận**.

## Cấu trúc file

```
bench/
  index.html           — trang bench chính
  packet-parser.js     — phân tích gói BLE (iBeacon, Eddystone)
  room-resolver.js     — phân giải beacon → phòng
  beacon-source.js     — nguồn thật (Web Bluetooth) + giả lập
  beacon-map-sample.json — bảng ánh xạ mẫu (placeholder, không UUID thật)
  README.md            — tài liệu này

tests/
  bench.test.mjs       — unit tests cho packet-parser và room-resolver
```
