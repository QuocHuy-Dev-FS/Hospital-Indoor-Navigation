# Plan CP-BEACON-MAP-PLAN (2026-11-02) — Beacon thật trên bản đồ 3D chính

> Trạng thái: **CHỜ DUYỆT (Cổng 1)**. Chưa sửa mã sản phẩm. UUID luôn che (f673****).
> Nguồn: khảo sát explorer + lead tự đối chiếu các file được trích (PositionMarker.js, SceneBuilder.js, index.html, beacon-admin/main.js, floors.json).

## 1. Kết quả khảo sát (a–e)

**a. Marker và hệ tọa độ**
- `src/scene/PositionMarker.js:24` `setPosition(x, y, z, scene, opts)` — KHÔNG nhận tầng; `scene.add` ở gốc cảnh (dòng 67). Chỉ được gọi từ `_onProviderChange` trong `src/main.js` (~1640) bằng door node của phòng.
- Mỗi tầng là một group, `group.position.y = (level-1) * FLOOR_HEIGHT_M` (`src/scene/SceneBuilder.js:27`). `data/floors.json`: F1 elevation 0, F2 3.6… (9 tầng). → marker beacon nên là **con của group tầng** để tự đúng độ cao; hiện chưa có accessor lấy group theo `floorId` (cần thêm).
- `data/coordinate_system.json`: gốc (0,0), mét, X đông, Z nam (z tăng xuống), Y lên (toàn bộ ghi "Cần xác nhận"). `rooms.json`/`nodes.json`/`Map2D.js:3` cùng hệ. F1: x 0–34.92, z 0–41.92.
- `beacons.local.json` F1_B01 (x=10.0, z=3.2, h=2.0) **nằm trong F1_R003** (bounds x 9.8–13.14, z 0–6.24; doorNode F1_D003 cách 4.54 m). Cùng hệ với `data/beacons.json` về hình thức, **chưa tài liệu nào xác nhận hướng trục z của người đo → Cần xác nhận.**

**b. Hai mục thanh bên (`index.html:114-124`)**
- "Quét beacon (thử nghiệm)" = link `/scan/` (Web Bluetooth, `bench/beacon-source.js`), không đi qua app chính.
- "Cầu nối máy quét BLE (demo)" = nhập mã 6 số → `BridgeSource` (`src/positioning/bridge_source.js`, HTTP relay `/api/loc/*`, chỉ trả `roomId`, không có RSSI/key). Dòng "Chưa kết nối beacon với bản đồ" là chữ tĩnh (`index.html:124`).
- **Không dùng chung adapter** với `src/beacon-admin/main.js:8` (`LaptopBridgeSource` WebSocket `ws://127.0.0.1:8765` + `MockReplaySource`, `sources.js`). Hai nhánh dùng tên trường khác nhau: admin `key`, bench/ble_adapter `beaconKey`. Dạng key trong code là `<uuid>-<major>-<minor>` (gạch ngang), **không phải dấu hai chấm** như yêu cầu → ghi Câu hỏi mở.
- Phân loại registered/unknown: `src/beacon-admin/main.js:88-102` (DOM-bound, không import được trong Node). App chính không có khái niệm "unknown" (`RoomResolver` bỏ qua key lạ).

**c. "Vị trí của bạn"**
- `index.html:109-112` (`#pos-label`), `#sim-badge` (`index.html:138`), `updatePositionStatus` `src/main.js:1374`, subscriber `_onProviderChange` (~1640, đăng ký 2285). Hợp nhất nguồn ở `src/positioning/position_provider.js` (`SOURCE_PRIORITY = native, ble, bridge, mock, url, manual`; `report()` bắt buộc `roomId`).
- Thêm nguồn thứ hai (giai đoạn B): sửa `position_provider.js` (nguồn mới / báo theo tầng-x-z), `src/main.js` (tạo nguồn, nhánh trong `_onProviderChange`, nhãn), `index.html` nếu thêm UI, `tests/geofence_position.test.mjs`.
- Nhãn `#sim-badge` không thấy code đổi theo trạng thái → Cần xác nhận bằng grep sâu hơn khi làm B.

**d. Dữ liệu**
- Bản đồ dữ liệu có 9 tầng F1–F9 (`floors.json`), mỗi tầng 83 node/42 phòng. **Nhưng UI ghi "Cả 3 tầng" (`src/main.js:1063`) và nút "Cả 3 tầng"** → số tầng thực sự dựng trong cảnh: **Cần xác nhận** (có thể là 3 tầng hiển thị, hoặc mô hình mẫu fallback).
- F1_B01 **chưa gắn Room/doorNode**. `data/beacon-map.local.json` có 1 mục `…-1-1 → F1_R101`, nhưng `F1_R101` **không tồn tại** trong `rooms.json` (F1 chỉ R001–R042) → Cần xác nhận.
- Tọa độ 10.0/3.2 trùng ví dụ `docs/DATA_MODEL.md:57` (h khác 2.6/2.0) → khả năng cao là **tạm**; chưa có ghi nhận đã đo → Cần xác nhận.

**e. Timeout và bộ lọc**
- `LOST_TIMEOUT_MS = 10_000` ms (thời gian, không theo gói) ở `src/beacon-admin/main.js:12`, hằng số cứng, không cấu hình. Cùng khối: `WINDOW_SIZE = 5` (số gói, `SlidingWindow` trung bình cộng, không TTL), `TICK_MS = 2000`.
- `bench/room-resolver.js:12-19` `DEFAULT_PARAMS`: `sampleTTL_ms` 10000, `rssiThreshold` −80, `hysteresisMargin` 5 dB, `minConsecutive` 3 (số lần `resolve()` liên tiếp, resolve mỗi 500 ms) — đều "Cần xác nhận". `ble_adapter.js` không truyền override.
- Trạng thái nằm trong `getStatus` (`beacon-admin/main.js:135`): `never` / `active` / `weak` (RSSI < −80) / `lost` — **4 giá trị, không phải 3**; coi 3 trạng thái hiển thị là Đang phát / Tín hiệu yếu / Mất tín hiệu, còn `never` = "Chưa thấy" (không vẽ hoặc vẽ mờ). Tách được thành hàm thuần.
- Ba ngưỡng lệch nhau: 10 s (admin), 10 s (sampleTTL), 15 s (bridge_source/provider STALE_MS).
- Số đo thật: ~1 gói/5 s → 10 s chỉ chứa ~2 gói; rút nguồn → mất ≤10 s, cắm lại → "Đang phát" sau ~5 s.

## 2. PLAN A — Hiện marker beacon thật trên bản đồ chính

**Nguyên tắc:** vị trí từ file (tầng, x, z, height_m); RSSI chỉ cho trạng thái. Beacon chưa đăng ký không vẽ. Giai đoạn A **không** đổi "Vị trí của bạn".

**File / module**
1. MỚI `src/positioning/beacon_status.js` (thuần, không DOM): `beaconToKey(b)`, `computeBeaconStatus(entry, now, opts)` → `never|active|weak|lost`, `BEACON_STATUS_LABEL`, và `lostByPackets`: coi "lost" khi quá `max(lostMs, K × khoảng gói trung vị)`; K, lostMs là tham số (K=3 và lostMs=10 s là **Cần xác nhận**).
2. SỬA `src/beacon-admin/main.js`: import `getStatus`/nhãn/hằng số từ module trên (thay định nghĩa nội bộ; hành vi mặc định giữ nguyên 10 s) — **không copy code**.
3. MỚI `src/scene/BeaconLayer.js`: `planBeaconMarkers(registered, floorIdsInScene)` (thuần, test được) + lớp three.js gắn marker làm **con của group tầng** tại (x, height_m, z); màu theo trạng thái (xanh/cam/xám), nhãn id (F1_B01). Tầng không có trong cảnh → không vẽ, đếm vào "n beacon thuộc tầng chưa có trên bản đồ".
4. SỬA `src/scene/SceneBuilder.js`: thêm `getFloorGroup(floorId)` (1 hàm nhỏ, không đổi thiết kế).
5. SỬA `src/main.js` + `index.html`: trong mục "Cầu nối máy quét BLE (demo)" thêm công tắc "Hiện beacon trên bản đồ" + nút "Kết nối cầu nối máy (127.0.0.1)" dùng lại `LaptopBridgeSource`/`MockReplaySource` từ `src/beacon-admin/sources.js` (import, không nhân bản). Thay dòng tĩnh "Chưa kết nối beacon với bản đồ" bằng dòng trạng thái động ("Cầu nối: chưa kết nối / đang nhận · n/m beacon đang phát"). Danh sách beacon đăng ký nạp từ `/data/beacons.local.json` (fallback: không có file → không marker, hiện ghi chú); UUID chỉ nằm trong bộ nhớ, không in log/DOM.
6. MỚI `tests/beacon_status.test.mjs` (+ thêm vào script `test` trong package.json — chỉ thêm tên file, không đổi framework).

**Hành vi khi bridge mất kết nối:** mọi marker → "Mất tín hiệu" (xám, tooltip "cầu nối ngắt"), dòng trạng thái đổi, tự kết nối lại theo backoff có sẵn của `LaptopBridgeSource`; không giữ "Đang phát" giả.

**Tiêu chí nghiệm thu đo được**
- A1: với MockReplay, F1_B01 hiện ở (10.0, 2.0, 3.2) cục bộ trong group F1 (test kiểm tra `planBeaconMarkers`).
- A2: test 3 trạng thái (active/weak/lost) + never bằng `now` truyền vào; test timeout theo gói (gói 5 s: không lost trước K×5 s).
- A3: mất bridge → tất cả marker `lost` trong ≤1 tick (test với WebSocket giả như `beacon_admin.test.mjs`).
- A4: beacon không đăng ký → 0 marker (test).
- A5: tầng không có trong cảnh → không vẽ, đếm đúng (test).
- A6: `npm test` pass toàn bộ (103 + mới); `python -m unittest tools/beacon_setup/test_beacon_setup.py -v` 24/24; `npm run build` OK; `npm run validate` 0 lỗi; `git check-ignore data/beacons.local.json` có luật; grep file tracked không thấy UUID thật.
- Người dùng tự xác nhận (không thể tự động): marker F1_B01 đúng chỗ trên tầng 1 (trục z có đúng hướng nam không), rút nguồn → "Mất tín hiệu" ≤ thời gian chốt, cắm lại → "Đang phát". Hướng dẫn sẽ ghi vào HUONG_DAN.md.

**Phương án gói thưa (không Burn):** (1) nâng timeout/tính theo số gói — làm trong A, an toàn, chỉ đổi phần mềm; (2) rút chu kỳ phát trong NanoBeacon Config — **chủ dự án tự làm**, chỉ Run-in-RAM, không Burn, và tốn pin; (3) cả hai. Đề xuất: (1) ngay, (2) thử sau khi có số đo mới. Không đề xuất Burn.

## 3. PLAN B — Beacon gần nhất làm "Vị trí của bạn" (CHỈ làm sau Cổng 2)

**Xung đột phase:** B là định vị BLE = Phase 5 (`ROADMAP.md`), phase hiện tại chưa tới; Phase 5 phụ thuộc Phase 0 phê duyệt gắn beacon. Không tự chuyển phase → cần người dùng cho phép riêng.

**Thiết kế**
- Nguồn mới `beacon-local` (laptop-bridge) trong `position_provider.js`; ưu tiên dưới `native/ble`, trên `manual`. Chỉ nhận beacon **đã đăng ký và `active`**.
- Gần nhất = RSSI trung bình cửa sổ N gói (N=5, đang là `WINDOW_SIZE`, **Cần xác nhận**) cao nhất; hysteresis: đổi sang beacon khác chỉ khi hơn ≥ H dB (mặc định 5, **Cần xác nhận**) liên tiếp M gói (M=3, **Cần xác nhận**); hằng số nằm trong một object cấu hình.
- Timeout theo số gói (K × khoảng gói) → hết hạn thì `markLost` → "Chưa chọn vị trí" (không giữ vị trí cũ, không mặc định giả).
- Map beacon → phòng: cần `roomId`/`doorNodeId` cho beacon (hiện F1_B01 chưa có; đề xuất tính từ tọa độ nằm trong bounds phòng, nhưng đây là thay đổi dữ liệu/suy diễn → cần duyệt; **không đổi schema** nên nếu cần thêm trường sẽ dừng, ghi Câu hỏi mở).
- Nhãn đổi: "Vị trí từ beacon F1_B01 · gần nhất" (thay `#sim-badge` khi nguồn là beacon); chọn thủ công vẫn là dự phòng.
- File: `position_provider.js`, `main.js`, `index.html`, module chọn beacon thuần mới `src/positioning/nearest_beacon.js`, `tests/nearest_beacon.test.mjs`, cập nhật `tests/geofence_position.test.mjs`.
- Nghiệm thu: không nhảy phòng trong test hysteresis với 2–3 beacon giả (Mock); mất tín hiệu → "Chưa chọn vị trí"; beacon lạ bị bỏ; nhãn đúng.
- **Giới hạn trung thực:** hiện chỉ 1 beacon thật và chưa từng thử phòng kề qua tường → "đúng phòng" **không** được tuyên bố đã kiểm chứng; hysteresis chỉ kiểm bằng Mock.

## 4. Rủi ro
- Gói 5 s khiến trạng thái chớp/chậm; mọi ngưỡng đang "Cần xác nhận".
- `LaptopBridgeSource` hard-code `127.0.0.1` → chỉ chạy khi trình duyệt và bridge cùng laptop (đúng phạm vi: laptop Windows).
- Fetch `/data/beacons.local.json` hoạt động ở dev server; bản `build` không nên phục vụ file có UUID → A chỉ hỗ trợ dev (`npm run dev`) và ghi rõ; không đưa file vào `dist`.
- Hai nhánh tên trường `key`/`beaconKey` dễ nhầm; A dùng `key` (nhánh admin).

## 5. Câu hỏi mở (đã ghi ROADMAP Q30–Q35)
Xem `ROADMAP.md`.
