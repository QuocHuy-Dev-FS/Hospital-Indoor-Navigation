# Hospital Indoor Navigation – Bệnh viện Quân y 7A

> Tên tạm. Trạng thái: **khung dự án và tài liệu (chưa có code tính năng).**

## 1. Giới thiệu và mục tiêu

Hệ thống dẫn đường trong bệnh viện dùng **BLE beacon**. Bệnh nhân mở ứng dụng, xem **bản đồ 3D** của bệnh viện, tìm phòng/khoa cần đến (phòng khám, xét nghiệm, X-quang, thu ngân, nhà thuốc, WC, thang máy...). Hệ thống xác định vị trí hiện tại qua beacon và **dẫn đường từng bước** tới đúng phòng, có chế độ **AR** chồng mũi tên chỉ đường lên camera.

Mô hình triển khai (giả thuyết, chốt Phase 1): **mỗi phòng/điểm đến có một beacon**; app nhận biết beacon gần nhất để xác định vùng (proximity/zone), không cần tính tọa độ chính xác. Xem [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) mục 9.

Đối tượng dùng: bệnh nhân, người nhà, người cao tuổi, người đi xe lăn (Cần xác nhận ở Phase 0). Thiết bị: iOS/Android, kiosk (Cần xác nhận).

## 2. Kiến trúc tổng quan (dự kiến, chốt ở Phase 1)

```
Sơ đồ mặt bằng ──► [Quy trình FLOORPLAN_TO_3D] ──► GLB + JSON hình học
                                                          │
Dữ liệu phòng/khoa/nút/cạnh/beacon (data/) ───────────────┤
                                                          ▼
Beacon BLE ──► App (quét RSSI → proximity/zone → phòng hiện tại) ──► Đồ thị + A* ──► Chỉ đường chữ/giọng nói/AR
                                                          ▲
Công cụ admin (Phase 8) ──── cập nhật dữ liệu/bản đồ ─────┘
```
*(Định vị chính: proximity/zone — Phase 5. Trilateration/fingerprinting là tùy chọn nâng cao.)*

Chi tiết: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 3. Cấu trúc thư mục

| Đường dẫn | Nội dung | Trạng thái |
|---|---|---|
| `README.md`, `HUONG_DAN.md`, `ROADMAP.md`, `CLAUDE.md` | Tài liệu gốc | Có |
| `PROJECT_STATUS.md`, `HANDOVER.md` | Trạng thái và bàn giao giữa các phiên | Có |
| `docs/` | WORKFLOW, ARCHITECTURE, FLOORPLAN_TO_3D, DATA_MODEL, PRIVACY_SECURITY, **HARDWARE** | Có |
| `assets/hardware/` | Tài liệu phần cứng beacon: ghi chú datasheet, nguồn tài liệu, PDF hãng | Có (CP-HARDWARE-DOCS) |
| `data/` | Dữ liệu phòng/khoa, đồ thị, beacon (sinh bởi generate_data.mjs) | Có (P0.5) |
| `assets/floorplans/` | Sơ đồ mặt bằng gốc (ảnh/PDF/DWG) | Chờ sơ đồ thực |
| `assets/models/` | Mô hình 3D (GLB) | Chưa có – dựng runtime từ JSON |
| `tools/generate_data.mjs` | Sinh toàn bộ data/*.json từ floor template | Có (P0.5) |
| `tools/validate_data.mjs` | Kiểm tra tính hợp lệ dữ liệu | Có (P0.5) |
| `tools/floorplan/` | Pipeline Python: ảnh → GLB (chờ ảnh sơ đồ) | Có (skeleton) |
| `src/` | Mã nguồn web prototype (Three.js, A*, search, BLE sim) | Có (P0.5) |
| `tests/nav.test.mjs` | Unit tests: A*, tìm kiếm, sinh chỉ dẫn | Có (P0.5) |

## 4. Cách chạy

### Prototype P0.5 – Giao diện 3D chạy ngay

```bash
# 1. Cài dependency
npm install

# 2. Sinh dữ liệu (lần đầu hoặc khi cần cập nhật)
node tools/generate_data.mjs

# 3. Khởi động dev server
npm run dev
# → Mở http://localhost:5173
```

**Quan trọng: phải mở qua `http://localhost`, không phải `file://`.**
Khi mở file trực tiếp (file://), fetch `/data/*.json` thất bại và bản đồ không tải được.

**Phím tắt trong ứng dụng:**
- Số `1`–`9`: chuyển tầng
- `Shift + Click` lên phòng: đặt vị trí mô phỏng
- `←/→`: bước trước/tiếp trong chỉ dẫn

**URL params hữu ích:**
| Param | Tác dụng |
|---|---|
| `?debug=1` | Debug overlay: FPS, draw calls, tier, DPR, thời gian tải |
| `?force2d=1` | Bỏ qua WebGL, hiện bản đồ 2D SVG + tìm phòng + tìm đường |
| `?dev=1` | Bật nút Xuất GLB và mô phỏng mất tín hiệu |
| `?kiosk=1` | Chế độ kiosk (chữ lớn, nút to) |

**Khi thấy lỗi "Bản đồ 3D không hiển thị được":**
1. Nhấn F12 → tab Console → xem thông báo `[WebGL]` để biết lý do thật
2. Nút **📋 Sao chép lỗi** trong màn hình lỗi sao chép chi tiết lỗi ra clipboard
3. Kiểm tra `coccoc://gpu` hoặc `chrome://gpu` — WebGL phải là "Hardware accelerated"
4. Dùng `?force2d=1` để xem bản đồ 2D trong khi chờ sửa lỗi 3D

### Trang quản trị Beacon (kỹ thuật viên)

Trang riêng để xem beacon đang phát, gán vị trí beacon mới, ghi CalibrationRecord.
Yêu cầu cầu nối Python chạy trên laptop cùng Bluetooth adapter.

```bash
# Terminal 1 — cầu nối Python (lần đầu: tạo venv và cài gói)
cd tools/beacon_bridge
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
cp allowlist.json.example allowlist.json   # rồi điền UUID thật
python bridge.py

# Terminal 2 — Vite dev server (như bình thường)
npm run dev
# Mở http://localhost:5173/beacon-admin.html
```

Xem chi tiết: [tools/beacon_bridge/README.md](tools/beacon_bridge/README.md)

### Truy cập từ điện thoại khi dev

Dùng lệnh sau để chạy dev server trên toàn bộ network interface, đồng thời in link IP LAN ra terminal:

```bash
npm run dev:lan
```

Terminal sẽ in:

```
  Local:   http://localhost:5173
  Network: http://192.168.x.x:5173   ← mở link này trên điện thoại cùng Wi-Fi
```

**Điều kiện:**
- Điện thoại và máy tính phải cùng mạng Wi-Fi.
- Lần đầu chạy, **Windows Defender Firewall** có thể hỏi quyền — chọn **"Cho phép truy cập" (mạng Private)**.
- Wi-Fi công cộng hoặc mạng bệnh viện có thể bật **"client isolation"** (cô lập thiết bị) — điện thoại sẽ không kết nối được dù cùng Wi-Fi.

**Giới hạn HTTP quan trọng:**
Truy cập qua `http://<IP>` **không phải secure context**, vì vậy các API sau **sẽ không hoạt động** trên điện thoại:
- Camera (AR)
- Cảm biến hướng / la bàn (DeviceOrientationEvent, DeviceMotionEvent)
- Web Bluetooth (quét beacon BLE)
- Các API yêu cầu HTTPS khác

Để dùng được những tính năng này khi dev, cần bật HTTPS — quyết định này cần bàn riêng ở Claude Chat.

**Kiểm tra và build:**
```bash
node tools/validate_data.mjs   # kiểm tra dữ liệu (0 lỗi)
npm test                       # unit tests (nav + map2d + beacon_admin)
npm run build                  # bundle production (bao gồm beacon-admin.html)
npm run preview                # xem bản build
```

### Mở luồng bản đồ di động trên điện thoại (Bản thử nghiệm)

Luồng "Khám phá bản đồ 3D" kiểu Google Maps (S0 khám phá, S1 tìm kiếm, S2 thiết lập tuyến, S3 dẫn đường) chạy trên dữ liệu thử nghiệm.

1. Chạy `npm run dev:lan` (hoặc `npm run dev -- --host`).
2. Mở `http://<IP>:5173` trên điện thoại cùng Wi-Fi.
3. Luồng chỉ bật khi màn hình rộng tối đa 700 px, và không bật khi kiosk, `?force2d`, `?model=glb`.

Giới hạn:
- GPS và Web Bluetooth cần HTTPS nên không chạy qua `http://<IP>`. Dùng chọn vị trí thủ công, `?from=<roomId>` hoặc bridge demo (trong bộ chọn điểm xuất phát).
- Geofence hiện ở trạng thái "chưa cấu hình" (`data/geofence.json`), nên ứng dụng không hỏi GPS.
- HTTPS cho dev chưa được cài đặt; đây là câu hỏi mở cần bàn ở Claude Chat.
- Vị trí người dùng chỉ nằm trong bộ nhớ trang, không lưu, không gửi, không đưa vào URL.

## 5. Cách làm việc

Dự án dùng hai môi trường tách vai: **Claude Chat** (lập kế hoạch, soạn prompt) và **Claude Code trong Antigravity** (thực thi). Xem [docs/WORKFLOW.md](docs/WORKFLOW.md) và [CLAUDE.md](CLAUDE.md). Lộ trình: [ROADMAP.md](ROADMAP.md).

## 6. Bước tiếp theo

Cung cấp sơ đồ mặt bằng bệnh viện vào `assets/floorplans/`, sau đó lập kế hoạch Phase 0–1 ở Claude Chat.

---

## Cách chạy (cập nhật 2026-10-23, CP-SAMPLE3D-A)

### Yêu cầu

- Python 3.12+ (đã kiểm tra 3.15.0)
- Node.js 18+ (đã kiểm tra 24.21.0)

### Cài đặt

```bash
# Python packages (trong tools/.venv – đã tạo sẵn)
tools/.venv/Scripts/pip install opencv-python-headless numpy trimesh

# JavaScript packages
npm install
```

### Chạy pipeline sơ đồ → 3D (cần ảnh trước)

```bash
# Đặt ảnh vào: assets/floorplans/F1_sample_2026-10-23.jpg
tools/.venv/Scripts/python tools/floorplan/run_pipeline.py assets/floorplans/F1_sample_2026-10-23.jpg --floor F1
# Kết quả: data/sample/F1/*.json, assets/models/sample/F1.glb, assets/floorplans/_debug/
```

### Xem viewer (sau khi có dữ liệu – chưa triển khai)

```bash
npm start  # http://127.0.0.1:5173 (chưa có src/web/)
```

### Kiểm thử

```bash
npm test         # Node test runner (chưa có tests/)
npm run test:py  # Python unittest (chưa có tools/tests/)
npm run validate # Validate dữ liệu (chưa có tools/validate-data.mjs)
```

> **Trạng thái:** Viewer, validator, test chưa được viết (chờ D–H sau khi có ảnh sơ đồ).
