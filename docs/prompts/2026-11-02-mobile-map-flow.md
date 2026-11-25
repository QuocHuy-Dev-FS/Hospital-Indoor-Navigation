# PROMPT THỰC THI — Luồng di động "Khám phá bản đồ 3D" kiểu Google Maps (nguyên mẫu giao diện)

> Lưu tại: `docs/prompts/2026-11-02-mobile-map-flow.md` (đội trưởng lưu file).
> **Cổng duyệt:** Prompt này đã gộp sẵn bước 1 (khảo sát) và bước 2 (kế hoạch thay đổi tối thiểu) của yêu cầu gốc. Vì vậy chỉ có **một cổng duyệt**: cổng "HÃY THỰC THI PROMPT NÀY" của `/hin`. Khi người dùng đã gõ đúng câu đó, executor làm từ mục 7 tới hết, không dừng xin duyệt lần nữa. Executor chỉ dừng nếu gặp quyết định kiến trúc ngoài kế hoạch này; khi đó ghi lại cho đội trưởng đưa vào "Câu hỏi mở".

---

## 1. VAI TRÒ

Bạn là `hin-executor` của đội /hin, dự án Hospital Indoor Navigation – BV Quân y 7A. Nhiệm vụ: làm lại luồng giao diện di động "Khám phá bản đồ 3D" theo kiểu Google Maps trên điện thoại, gồm state machine S0–S3, lớp nổi tối thiểu, điều khiển camera, PositionProvider, geofence và các trạng thái lỗi. Đây là **nguyên mẫu giao diện trên dữ liệu thử nghiệm**.

## 2. BỐI CẢNH

- Đọc `CLAUDE.md`, `ROADMAP.md`, `PROJECT_STATUS.md`, `HANDOVER.md` (mục CP-NAV-BLE, CP-DEV-LAN, CP-THREE-FLOOR-UI). Chỉ đọc mã liên quan, theo danh sách ở mục 5.
- **Phase:** theo ROADMAP.md:6, phase chính thức là "Chuẩn bị → chờ Phase 0". Việc này thuộc nội dung Phase 4/6. Chủ dự án đã cho phép làm giao diện ngoài phase dưới nhãn "Bản thử nghiệm" (PROJECT_STATUS.md:443-450) và cho phép rõ trong yêu cầu này. **KHÔNG đánh dấu Phase 4 hay 6 là hoàn thành. KHÔNG đổi bảng tiến độ trong ROADMAP.**
- Repo: nhánh `master`, **chưa có commit nào**, mọi file đều untracked. Không dùng `git diff` thường được. Phải sao lưu trước khi sửa (xem mục 8).
- Dữ liệu phòng là `provisional – sơ đồ mẫu` (HANDOVER.md:134-149). Mọi nhãn "thử nghiệm" hiện có phải được giữ.
- Dữ kiện nền tảng (nguồn ở cuối):
  - (a) iPhone Safari không có Web Bluetooth. Đọc iBeacon trên iOS cần app native (Core Location). Bridge Python chỉ bind 127.0.0.1; relay `/api/loc/push` chỉ nhận từ localhost (vite.config.js:26). Vì vậy trên điện thoại hiện không có nguồn beacon thật, chỉ có relay demo qua laptop.
  - (b) GPS trong nhà không cho biết tầng và sai số lớn. GPS **chỉ** dùng để kiểm tra trong/ngoài khuôn viên, **không** dùng để vẽ vị trí trong nhà.
  - (c) Geolocation chỉ chạy trong secure context (HTTPS hoặc localhost). `http://<IP LAN>` không phải secure context.
- Mỗi phòng có một beacon. Điểm đến là phòng trong dữ liệu.
- Dependencies giữ nguyên: `three` 0.186.1, dev `vite` ^5.4.21. Không thêm gì.

## 3. MỤC TIÊU

Trên màn hình di động (định nghĩa ở mục 6.1), app chạy theo state machine:

- **S0 KHÁM PHÁ:** bản đồ 3D toàn màn hình (100dvh, tôn trọng safe-area iOS). Chỉ có: ô tìm kiếm dạng viên thuốc ở trên cùng "Bạn muốn đến đâu?", nút chọn tầng nhỏ, nút "Vị trí của tôi". Không có panel chỉ đường hay thanh chức năng nào khác.
- **S1 TÌM KIẾM:** chạm ô tìm kiếm → lớp tìm kiếm toàn màn hình, input được focus, gợi ý theo tên/mã/khoa (gõ không dấu được), có nút quay lại. Không có kết quả → thông báo rõ ràng.
- **S2 THIẾT LẬP TUYẾN:** chọn một kết quả → bản đồ bay tới và tô sáng phòng đó. Đồng thời hiện khung chỉ đường gồm:
  - "Điểm xuất phát": tự điền nếu có vị trí tin cậy; nếu không thì hiện "Chọn điểm xuất phát" với 2 cách: chạm trên bản đồ hoặc chọn từ danh sách mốc/phòng.
  - "Điểm đến": đã điền sẵn.
  - Nút đảo chiều và công tắc "Xe lăn (không bậc thang)".
  - Đường đi tổng quan vẽ trên bản đồ.
  - Thẻ dưới đáy ghi khoảng cách, số tầng phải đổi và nút "Bắt đầu". Nếu hiện thời gian thì ghi "ước tính".
- **S3 ĐANG DẪN ĐƯỜNG:** chạm "Bắt đầu" → camera phóng và nghiêng về điểm đứng hiện tại (chấm vị trí + vòng độ tin cậy); tuyến được tô nổi bật tới đích.
  - Banner trên cùng hiện chỉ dẫn kế tiếp bằng chữ lớn.
  - Thanh dưới hiện quãng còn lại và nút "Kết thúc".
  - Có nút "Về vị trí của tôi" khi người dùng kéo bản đồ đi.
  - Khi tuyến đổi tầng: tự chuyển tầng và báo rõ thang máy hay cầu thang.
- **Thoát/quay lại:** nút back của trình duyệt (history) và nút ✕ đưa về state trước, cuối cùng về S0.

## 4. PHẠM VI

**Được làm:**
- Sửa UI/CSS/state của màn hình bản đồ và camera viewer.
- Thêm module nhỏ: state machine, PositionProvider hợp nhất nguồn vị trí, geofence, tóm tắt tuyến/chỉ dẫn theo mốc.
- Thêm file cấu hình geofence ở trạng thái "chưa cấu hình".
- Viết test.
- Thêm mục hướng dẫn vào README.
- Sửa `package.json` **chỉ dòng `scripts.test`**, chỉ nối thêm tên file test mới. Đây là thay đổi phải được duyệt (xem "Cần người dùng quyết", câu 2).

**NGOÀI phạm vi (không làm):**
- Cài dependency, kể cả plugin HTTPS cho Vite hay mkcert.
- App native.
- Sửa `data/rooms.json`, `data/nodes.json`, `data/edges.json`, `data/connectors.json`, `data/floors.json`, `data/beacons*.json`, `data/beacon-map*.json`.
- Sửa `src/nav/astar.js`, `src/nav/instructions.js`, `src/search/search.js`, `src/positioning/bridge_source.js`, `src/positioning/ble_adapter.js`, `src/beacon-admin/**`.
- Sửa `scan/index.html`, `beacon-admin.html`, `bench/**`, `vite.config.js`, `tools/**`.
- Xóa hoặc làm hỏng tính năng đang có: trang Quét beacon, bố cục kiosk (`?kiosk`), bố cục desktop, chế độ `?force2d=1`, `?model=glb`, `?mock=1`, `?from=`/`?at=`, `?beacon=real`, bridge demo, đọc to, cỡ chữ, tương phản, tiết kiệm pin.
- Commit, push, deploy.
- Cập nhật `PROJECT_STATUS.md`, `HANDOVER.md`, `ROADMAP.md`: việc của đội trưởng. Executor chỉ ghi nội dung đề xuất vào báo cáo.
- Đụng tới `index.html.bak-2026-10-26`, `src/main.js.bak-2026-10-26`.

## 5. KHẢO SÁT HIỆN TRẠNG (planner đã đọc, executor đối chiếu lại)

### 5.1 Tên lớp nguồn vị trí: tên trong yêu cầu và tên thật trong mã

| Tên trong yêu cầu | Có thật? | Vị trí thật | Ghi chú |
|---|---|---|---|
| `BeaconObservation` | Chỉ là interface JSDoc | `src/beacon-admin/sources.js:4-5` `{key, rssi, txPower, timestamp, source}` | Không phải class |
| `LaptopBridgeSource` | Có | `src/beacon-admin/sources.js:13` (WebSocket ws://127.0.0.1) | Chỉ trang beacon-admin dùng (`src/beacon-admin/main.js:8`). App chính KHÔNG dùng |
| `MockReplaySource` | Có | `src/beacon-admin/sources.js:125` | Phát RSSI theo khóa beacon, chỉ dùng cho beacon-admin |
| Nguồn bridge của app chính | — | `BridgeSource`, `src/positioning/bridge_source.js:17` | Polling `/api/loc/poll`, callback `{roomId, floorId, confidence, timestamp}`, status `connecting/active/lost` |
| Nguồn BLE của app chính | — | `start(beaconMap, onRoom)`, `src/positioning/ble_adapter.js:19` | Chỉ khi `?beacon=real` (main.js:500-502). Status `near-room/lost` |
| Mock của app chính | — | `_startMockPlayback()`, `src/main.js:1586-1608` | `?mock=1`, đặt `simPosition` theo node tuyến mỗi 3 s |
| Giả lập | — | `BeaconSimulator`, `src/positioning/beacon_sim.js:22` | Dev tool mất tín hiệu, main.js:996-1023 |

**Quyết định:** PositionProvider mới **không** import `src/beacon-admin/sources.js`. Nó nhận dữ liệu qua adapter từ các nguồn thật của app chính: `bridge`, `ble`, `mock`, `manual`, `url`, và để chỗ cho `native` sau này.

### 5.2 Bảng luồng hiện tại và luồng mới

| Hạng mục | Hiện tại (dẫn chứng) | Luồng mới |
|---|---|---|
| Vào bản đồ | Splash → `showMain()` hiện `#app-header` + `#main-layout` (main.js:1035-1041; index.html:46-126) | Giữ splash. Sau "Khám phá bản đồ 3D" vào **S0** |
| Bố cục điện thoại | Header 120px; canvas 45% chiều cao ở trên, side-panel ở dưới (wayfinding.css:139-152) | S0: canvas full 100dvh. Header, side-panel, toolbar, caption, map-actions, map-help, sim-badge bị ẩn ở mobile-flow |
| Tìm kiếm | Dropdown dưới `#search-input` trong header (index.html:54-59; main.js:810-826); chọn → `selectRoom` → `#room-sheet` (main.js:1141-1162) | **S1**: overlay toàn màn hình, nút quay lại, input ≥16px, gợi ý, thông báo không có kết quả |
| Chọn đích | Chỉ qua room-sheet "Dẫn đường đến đây" (main.js:979-986), hoặc gõ `#nav-to` trong panel | **S2**: chọn kết quả → điền sẵn Điểm đến, bay tới và tô sáng phòng |
| Điểm xuất phát | `#nav-from` gõ tay, hoặc nút `btn-use-position` lấy `simPosition` (main.js:1293-1297) | Tự điền nếu PositionProvider có vị trí tin cậy. Nếu không: "Chọn điểm xuất phát" (chạm bản đồ / danh sách) |
| Đảo chiều | Không có | Nút đảo chiều (aria-label "Đảo điểm xuất phát và điểm đến") |
| Xe lăn | Checkbox `#wheelchair-mode` (index.html:82), `astar(..., {wheelchairOnly})` lọc `wheelchairOk` (astar.js:85) | Công tắc "Xe lăn (không bậc thang)" đồng bộ với `#wheelchair-mode`, thêm kiểm tra phòng thủ "không có cạnh stairs" |
| Tóm tắt tuyến | `route-distance` "Khoảng cách: X m · N bước" (main.js:1217-1218), không đếm số lần đổi tầng | Thẻ đáy: khoảng cách (ước tính), số tầng phải đổi, nút "Bắt đầu". Mặc định không hiện thời gian |
| Vẽ tổng quan | `routeRenderer.drawRoute` + pin đích (main.js:1207-1210), camera không fit tuyến | Giữ renderer, thêm `fitRouteOverview()` để camera bao trọn tuyến |
| Bắt đầu | `startNavMode()` bay tới node **bước đầu** chứ không phải vị trí người dùng (main.js:1433-1450) | **S3**: bay nghiêng tới **vị trí hiện tại** (marker), follow-mode |
| Banner | `#nav-banner`, chữ 1.1rem trên mobile (≈17.6px, wayfinding.css:292); nút min-height 40px (wayfinding.css:293) | Banner trên ≥20px, nút ≥48px; thanh dưới: quãng còn lại + "Kết thúc" |
| Về vị trí | Nút `btn-nav-go-to-me` luôn hiện (index.html:151; main.js:838-842) | Nút "Về vị trí của tôi" chỉ hiện khi người dùng kéo bản đồ (controls `start`, main.js:166) |
| Đổi tầng | `_updateNavBanner` tự `setActiveFloor` (main.js:1493-1499), không có thông báo riêng | Tự chuyển tầng + thông báo aria-live "Đi thang máy/cầu thang lên/xuống …" |
| Back/✕ | Không có `pushState`/`popstate` trong main.js (grep) | History stack S0←S1←S2←S3; `popstate` và ✕ dùng chung `back()` |
| Nguồn vị trí | `simPosition` toàn cục (main.js:108), ghi rải rác: URL (595-606, 480-494), thủ công (919-939), shift-click (327-332), BLE (1400-1426), bridge (1526-1575), mock (1586-1608). `confidence` của bridge bị bỏ qua (1542) | `PositionProvider` hợp nhất, mỗi vị trí có `confidence`, `source`, `timestamp`. `simPosition` vẫn được đồng bộ để mã cũ chạy |
| GPS/Geofence | Không có (không tìm thấy `geolocation`/`geofence` trong src) | `geofence.js` + `data/geofence.json` ở trạng thái `unconfigured` → **không gọi GPS** |
| Mất beacon | `#signal-lost-banner` + toast (index.html:138; main.js:1414-1418, 1562-1566). Không có chỉ dẫn theo mốc | S3: cảnh báo "Độ tin cậy thấp", giữ tuyến, chỉ dẫn theo mốc (tên phòng/ngã rẽ), nút "Đặt lại điểm đứng" |
| Tìm "khoa" | `RoomSearch` tìm `nameAscii`/`aliases`/`id` (search.js:17-56). `data/rooms.json` **không có trường khoa** (grep 0 kết quả) | Không sửa search.js. Ghi "Cần xác nhận: dữ liệu chưa có trường khoa" trong UI help/báo cáo |
| Kiosk/desktop | `body.kiosk-mode` (main.js:29; styles.css:529-534); desktop dùng side-panel | **Giữ nguyên**: mobile-flow không bật khi kiosk, force2d, glb hoặc màn hình > 700px |
| Dữ liệu cạnh | 59 cạnh `stairs`/`elevator` trong edges.json; các cạnh stairs đã xem đều `wheelchairOk:false` (edges.json:153-154, 504-505, …) | Test xác nhận trên dữ liệu thật: tuyến xe lăn không dùng cạnh stairs |

## 6. KẾ HOẠCH THAY ĐỔI (file sửa/thêm)

### 6.1 Giả định mặc định (người dùng có thể đổi khi duyệt)

1. **Phạm vi mobile-flow:** chỉ bật khi `matchMedia('(max-width: 700px)')` khớp (trùng breakpoint hiện có ở wayfinding.css:139 và hospital-theme.css:131) **và** không có `?kiosk`, `?force2d`, `?model=glb`. Bật bằng class `body.mobile-flow`; đánh giá lại khi resize. State machine giữ nguyên context khi đổi breakpoint. Desktop và kiosk giữ luồng cũ.
2. **Chạm phòng ở S0** (mobile-flow): coi như chọn kết quả, chuyển sang S2 với phòng đó là điểm đến. `#room-sheet` không hiện trong mobile-flow. Desktop vẫn mở room-sheet như cũ.
3. **Nhãn thử nghiệm ở S0:** một chữ nhỏ "Thử nghiệm" nằm **trong** viên thuốc tìm kiếm (không phải thanh riêng). Badge MOCK vẫn hiện khi `?mock=1`. Coi đây là một phần ô tìm kiếm, không vi phạm "lớp nổi tối thiểu".
4. **Vị trí tin cậy** để tự điền Điểm xuất phát:
   - nguồn `manual` hoặc `url` (người dùng tự chọn/quét QR): luôn tin cậy, hiển thị "do bạn chọn";
   - nguồn `bridge`/`ble`/`mock`/`native`: tin cậy khi `confidence ≥ CONFIDENCE_MIN = 0.5` và tuổi ≤ `STALE_MS = 15000`. Cả hai hằng số ghi "Cần xác nhận"; 15000 khớp `SIGNAL_TIMEOUT_MS` ở bridge_source.js:15.
5. **Thời gian:** mặc định **không** hiện thời gian, để tránh số bịa. Chỉ hiện khoảng cách (ước tính) và số lần đổi tầng.
6. **Danh sách mốc/phòng** trong bộ chọn điểm xuất phát dùng chung `RoomSearch`. Có các nhóm nhanh "Thang máy", "Cầu thang", "WC" lấy bằng `getElevators/getStairs/getWC` (search.js:76-78).
7. **Nút "Vị trí của tôi" ở S0:**
   - có vị trí → bay tới;
   - không có → kiểm tra geofence (mục 6.4), hiện thông báo ngắn, mở bộ chọn "Bạn đang ở đâu?" (chọn thủ công).
8. **Bridge demo trên điện thoại:** trong bộ chọn điểm xuất phát có thêm mục gập "Nhận vị trí từ máy quét (demo)". Mục này dùng input/nút mới. Logic dùng lại `_connectBridgeSource` sau khi tách thành `_connectBridgeSource(code)`. Phần tử cũ `#bridge-code-input`/`#btn-bridge-connect` vẫn giữ nguyên ID và hành vi.

### 6.2 File THÊM

| File | Nội dung | Ràng buộc |
|---|---|---|
| `src/ui/mapFlow.js` | State machine thuần logic (S0–S3, stack, context). Không import DOM/three | Test được bằng `node --test` |
| `src/positioning/position_provider.js` | Hợp nhất nguồn vị trí, ưu tiên, độ tin cậy, mất tín hiệu | Không DOM, không fetch, không storage, không `console.*` tọa độ |
| `src/positioning/geofence.js` | Đánh giá geofence (polygon/circle), kiểm tra GPS một lần qua geolocation được inject, ánh xạ thông báo | Không log tọa độ, không lưu tọa độ |
| `src/nav/route_summary.js` | `summarizeRoute`, `pathUsesStairs`, `landmarkHint` | Thuần, dùng chung dữ liệu nodes/edges/rooms |
| `src/ui/mobile-flow.css` | Toàn bộ CSS mới, **chỉ** dưới selector `body.mobile-flow …` (trừ phần tử mới có `[hidden]{display:none!important}`) | Không ảnh hưởng desktop/kiosk |
| `data/geofence.json` | Cấu hình "chưa cấu hình" (mẫu ở 6.4) | Không có tọa độ thật hay bịa |
| `tests/map_flow.test.mjs` | Test state machine + route_summary + xe lăn trên dữ liệu thật | |
| `tests/geofence_position.test.mjs` | Test geofence 3 trạng thái + PositionProvider + fallback | |

### 6.3 File SỬA (sao lưu trước, xem mục 8)

| File | Thay đổi tối thiểu |
|---|---|
| `index.html` | Thêm `<link rel="stylesheet" href="/src/ui/mobile-flow.css" />` sau hospital-theme.css. Thêm khối markup mới trong `#canvas-wrap` hoặc ngay sau `#main-layout`, **không xóa/đổi ID nào hiện có**: `#mf-search-pill`, `#mf-floor-chip`, `#mf-locate`, `#mf-search-overlay` (`#mf-back`, `#mf-search-input`, `#mf-results`, `#mf-no-result`), `#mf-route-sheet` (`#mf-close`, `#mf-start`, `#mf-pick-start`, `#mf-dest`, `#mf-swap`, `#mf-wheelchair`, `#mf-summary`, `#mf-go`), `#mf-start-picker` (`#mf-start-input`, `#mf-start-results`, `#mf-pick-on-map`, `#mf-bridge-*`), `#mf-nav-top` (`#mf-nav-text`, `#mf-nav-sub`, `#mf-lowconf`), `#mf-nav-bottom` (`#mf-remaining`, `#mf-end`, `#mf-recenter`, `#mf-reset-pos`), `#mf-live` (aria-live polite) |
| `src/main.js` | Import 4 module mới; khởi tạo `mapFlow`, `positionProvider`; hàm `applyMobileFlowClass()`, `renderMobileFlow(state, ctx)`, `fitRouteOverview(nodes)`, `computeRoute(fromRoomId, toRoomId, wheelchair)` (tách lõi khỏi `findRoute`, `findRoute` cũ gọi lại nó để desktop không đổi hành vi); nối các nguồn (URL, thủ công, shift-click, BLE, bridge, mock) vào `positionProvider.report/setManual/markLost`, có subscriber đồng bộ `simPosition`; xử lý `popstate`; follow-mode trong S3; nhánh pointerup khi đang chọn điểm xuất phát trên bản đồ; nhánh chạm phòng ở S0 mobile-flow. Không xóa hàm cũ |
| `package.json` | **Chỉ** dòng `scripts.test`: nối thêm ` tests/map_flow.test.mjs tests/geofence_position.test.mjs` vào cuối. Không thêm `tests/streetview.test.mjs` |
| `README.md` | Thêm mục con "Mở luồng bản đồ di động trên điện thoại" ngay sau mục "Truy cập từ điện thoại khi dev" (README.md:104-139). Không xóa nội dung cũ |

**Không sửa:** `src/ui/wayfinding.css`, `src/styles.css`, `src/ui/hospital-theme.css`. Mọi ghi đè đặt trong `mobile-flow.css` dưới `body.mobile-flow`, vì file này được nạp sau cùng.

### 6.4 Đặc tả module mới (API tối thiểu, executor được tinh chỉnh tên nội bộ)

**`src/ui/mapFlow.js`**
```
export const STATES = { EXPLORE:'S0', SEARCH:'S1', ROUTE:'S2', NAV:'S3' };
export function createMapFlow({ onChange } = {}) → {
  get state(), get context(),   // context: { query, destination, start, wheelchair, routeOk, pickingStart, entry }
  openSearch(query = ''),       // S0|S2 → S1 (push)
  selectDestination(room, { via:'search'|'map' }),  // S1|S0 → S2 (push); context.destination = {roomId,label,floorId}
  setStart(place),              // place: {roomId,label,floorId,source}|null
  autoFillStart(place),         // chỉ điền nếu start đang rỗng
  beginPickStart(), endPickStart(),
  swap(),                       // đổi start↔destination; không làm gì nếu một trong hai rỗng
  setWheelchair(bool),
  setRouteOk(bool),
  canStartNav(),                // start && destination && routeOk && start.roomId !== destination.roomId
  startNavigation(),            // S2 → S3 (push) chỉ khi canStartNav()
  back(),                       // pop 1 bước: S3→S2, S2→(S1 nếu vào từ search, S0 nếu vào từ map), S1→S0; ở S0 không làm gì; trả về state mới
  reset()                       // về S0, xóa stack (giữ wheelchair)
}
```
Quy tắc:
- Chuyển trạng thái không hợp lệ (ví dụ S0→S3) → bỏ qua, không ném lỗi.
- `onChange(state, context, { pushed:boolean })` gọi sau mỗi lần đổi.
- Rời S3 về S2 giữ tuyến và context. Về S0 thì xóa destination/start/route, nhưng không xóa vị trí của PositionProvider.

**`src/positioning/position_provider.js`**
```
export const SOURCE_PRIORITY = ['native','ble','bridge','mock','url','manual']; // beacon trước, thủ công sau
export const CONFIDENCE_MIN = 0.5;  // Cần xác nhận
export const STALE_MS = 15000;      // Cần xác nhận
export function createPositionProvider({ now = () => Date.now() } = {}) → {
  report({ source, roomId, floorId, confidence, timestamp }),  // nguồn beacon
  setManual({ roomId, floorId, source:'manual'|'url' }),       // confidence = 1, label "do bạn chọn"
  markLost(source),
  current(),        // vị trí ưu tiên nhất còn hiệu lực hoặc null; kèm { source, confidence, lowConfidence, isUserChosen }
  isReliable(),     // theo mục 6.1-4
  status(),         // 'none' | 'beacon' | 'beacon-low' | 'manual'
  subscribe(fn) → unsubscribe,
  clear()
}
```
Quy tắc:
- Khi nguồn beacon bị `markLost` hoặc quá `STALE_MS`, `current()` rơi về manual/url nếu có; nếu không thì trả vị trí beacon cuối cùng với `lowConfidence: true`, để giữ chấm trên bản đồ ở trạng thái cam.
- Chỉ giữ bản ghi mới nhất cho mỗi nguồn, trong bộ nhớ.
- Không `localStorage`/`sessionStorage`, không gửi mạng, không `console.*` chứa roomId kèm thời gian.

**`src/positioning/geofence.js`**
```
export async function loadGeofenceConfig(fetchJSON) → config | { status:'unconfigured' }  // lỗi tải → unconfigured
export function evaluateGeofence(config, coords) → 'inside'|'outside'|'unconfigured'
export async function checkCampus({ config, geolocation, isSecureContext }) →
  { status: 'unconfigured'|'insecure'|'unsupported'|'denied'|'unavailable'|'timeout'|'inside'|'outside' }
export function geofenceMessage(status) → string|null
```
Quy tắc:
- `config.status !== 'configured'`, hoặc polygon < 3 đỉnh, hoặc circle thiếu `center`/`radius_m > 0` → `'unconfigured'`.
- Khi `'unconfigured'`, `checkCampus` **không gọi** `geolocation.getCurrentPosition` (test phải chứng minh).
- Thứ tự kiểm tra: `unconfigured` → `insecure` (`isSecureContext === false`) → `unsupported` → gọi GPS **một lần**, `enableHighAccuracy:false`, `timeout: 8000` (Cần xác nhận) → ánh xạ `error.code` 1/2/3 thành `denied`/`unavailable`/`timeout` → `evaluateGeofence`.
- Hàm trả **chỉ status**, không trả và không giữ tọa độ.
- Polygon: ray-casting trên `[lat, lng]`. Circle: haversine.
- `geofenceMessage`:
  - `outside` → "Định vị chỉ hoạt động trong bệnh viện";
  - `denied` | `insecure` | `unsupported` | `unavailable` | `timeout` → "Chưa bật quyền vị trí"; `insecure` có thể thêm " (cần HTTPS)";
  - `unconfigured` | `inside` → `null`. Khi đó UI chỉ hiện "Chọn điểm bạn đang đứng".
- GPS không bao giờ dùng để đặt marker trong nhà.

**`data/geofence.json`** (nguyên văn, không thêm tọa độ):
```json
{
  "_note": "Bản thử nghiệm. Chưa có tọa độ khuôn viên BV Quân y 7A – Cần xác nhận. Khi status khác 'configured', app bỏ qua kiểm tra GPS.",
  "status": "unconfigured",
  "type": null,
  "polygon": null,
  "center": null,
  "radius_m": null
}
```
Tải bằng `loadJSON('/data/geofence.json')` giống các file data khác (main.js:569-578). Lỗi tải → unconfigured, không chặn khởi động. Ghi "Cần xác nhận": bản `vite build` có phục vụ `/data/*.json` không. Đây là hành vi chung của mọi file data hiện có (`publicDir: 'public'`, vite.config.js:67), không sửa trong phiên này.

**`src/nav/route_summary.js`**
```
export function summarizeRoute(pathNodes, edges) → { distanceM, floorChanges, transitions:[{type:'elevator'|'stairs', fromFloor, toFloor, nodeId}] }
export function pathUsesStairs(pathIds, edges) → boolean   // dò cạnh theo cặp from/to (tính cả bidirectional)
export function remainingDistance(pathNodes, fromIndex) → number
export function landmarkHint(step, { rooms, nodes }) → string   // vd "Đi tới gần Phòng X (Tầng 1)"; không có phòng gắn node → "Đi tới mốc tiếp theo"
```
- `distanceM` cộng khoảng cách Euclid giữa các node. Hiển thị luôn kèm "(ước tính)".
- `floorChanges` = số lần `floorId` đổi giữa hai node liên tiếp.

## 7. CÁC BƯỚC THỰC THI (theo thứ tự)

1. **Đầu phiên:** `git status`, `git branch --show-current`. Đọc nhanh các file ở mục 5 để xác nhận số dòng còn đúng. Lệch nhiều thì ghi lại, không dừng.
2. **Baseline (TRƯỚC khi sửa bất kỳ file nào),** ghi nguyên kết quả:
   - `npm test` (kỳ vọng theo tài liệu: 103/103; ghi số thật)
   - `npm run build` (ghi thời gian, kích thước JS chính, cảnh báo)
   - `npm run validate` (kỳ vọng: 0 lỗi, 1 cảnh báo orphan; ghi số thật)
   - Không có script lint trong package.json → ghi "không có lint".
3. **Sao lưu** các file sẽ sửa (mục 8.1).
4. **Thêm module thuần** `mapFlow.js`, `position_provider.js`, `geofence.js`, `route_summary.js` và `data/geofence.json`. Chạy `node --check` từng file.
5. **Viết test** `tests/map_flow.test.mjs`, `tests/geofence_position.test.mjs` (mục 9.2). Chạy riêng bằng `node --test --test-force-exit tests/map_flow.test.mjs tests/geofence_position.test.mjs` cho tới khi xanh.
6. **Sửa `package.json`** (chỉ dòng `scripts.test`).
7. **Markup + CSS:** thêm khối `#mf-*` vào `index.html` (mọi phần tử mới mặc định `hidden`), tạo `src/ui/mobile-flow.css`. Yêu cầu CSS trong `body.mobile-flow`:
   - `#main-layout` và `#canvas-wrap` chiếm toàn màn hình: `position:fixed; inset:0; height:100dvh` (fallback `100vh` đặt trước). Ẩn `#app-header`, `#side-panel`, `.map-toolbar`, `.map-caption`, `.map-actions`, `.map-help`, `#sim-badge`, `#room-sheet`. Giữ `#signal-lost-banner` (đặt dưới pill), `#sample-data-badge`, `#nav-mock-badge`, `#toast-area`, `#loading-overlay`, `#webgl-fallback`.
   - Ẩn `#nav-mode-overlay` cũ khi mobile-flow, vì S3 dùng `#mf-nav-top`/`#mf-nav-bottom`. Logic nav cũ vẫn chạy.
   - Pill trên cùng: `top: calc(env(safe-area-inset-top) + 12px)`. Thanh/thẻ dưới: `padding-bottom: calc(env(safe-area-inset-bottom) + 12px)`. Trái/phải dùng `env(safe-area-inset-left/right)`.
   - Cỡ chữ: mọi chữ thường ≥16px, input ≥16px, chỉ dẫn S3 ≥20px (đề xuất 22px/600). Vùng chạm ≥48×48px cho mọi nút/ô chọn/mục gợi ý.
   - Tương phản WCAG AA: chữ thường ≥4.5:1, chữ lớn ≥3:1. Dùng màu sẵn có, ví dụ chữ `#0f2a24` trên `#ffffff`, nút chính trắng trên `#0d7a6e`. Executor tính tỉ lệ và ghi vào báo cáo; không ước lượng.
   - `body.mobile-flow.high-contrast` vẫn áp được biến màu tương phản cao.
   - `prefers-reduced-motion`: không animation; `moveCamera` đã tôn trọng (main.js:362).
8. **Nối main.js:**
   - a. `applyMobileFlowClass()` gọi trong `showMain()` và listener `change` của matchMedia. Bỏ qua khi `isKiosk || isForce2D || params.get('model')==='glb'`.
   - b. `positionProvider`:
     - URL `?from/?at` → `setManual({source:'url'})`;
     - chọn thủ công (main.js:920-932) và shift-click (327-332) → `setManual({source:'manual'})`;
     - BLE `near-room` → `report({source:'ble', confidence:1 /* Cần xác nhận: adapter chưa trả confidence */})`, `lost` → `markLost('ble')`;
     - bridge → `report({source:'bridge', confidence})` (lấy đúng `confidence` từ callback main.js:1542), `lost` → `markLost('bridge')`;
     - mock → `report({source:'mock', confidence:1})`.

     Có một subscriber duy nhất cập nhật `simPosition`, `posMarker.setPosition(..., {lowConfidence})`, `updatePositionStatus`. Mã cũ đặt `simPosition` trực tiếp được thay bằng gọi provider, giữ nguyên hành vi hiển thị.
   - c. **S0:**
     - Pill → `mapFlow.openSearch()`.
     - Floor chip mở menu nhỏ gồm 3 tầng, gọi `setActiveFloor` (main.js:1052), nhãn từ `floorName`.
     - `#mf-locate`: provider có vị trí → bay tới bằng `flyToPositionTilted`; không có → `checkCampus(...)` → toast `geofenceMessage` (nếu có) → mở `#mf-start-picker` ở chế độ "Bạn đang ở đâu?".
   - d. **S1:** focus `#mf-search-input`, dùng `searcher.search(q, 12)`. Mỗi mục hiện tên + tầng + mã phòng. Rỗng → `#mf-no-result` "Không tìm thấy phòng phù hợp. Thử tên khác hoặc mã phòng (ví dụ F1_R001)." Esc / `#mf-back` → `history.back()`.
   - e. **S2:**
     - `selectDestination` → `setActiveFloor(room.floorId)`, `builder.highlightRoom`, `flyToRoom`.
     - `autoFillStart(provider.current())` nếu `isReliable()`.
     - Có start → `computeRoute` → `routeRenderer.drawRoute` + pin đích → `fitRouteOverview` → `summarizeRoute` → `#mf-summary` dạng "Khoảng cách: ~N m (ước tính) · Đổi tầng: K lần (thang máy/cầu thang)".
     - Không có start → `#mf-pick-start` "Chọn điểm xuất phát" với 2 nút "Chạm trên bản đồ" (`beginPickStart`, toast hướng dẫn; pointerup trúng phòng → `setManual` + `setStart` + `endPickStart`) và "Chọn từ danh sách".
     - `#mf-go` bị `disabled` (kèm lý do aria-describedby) khi `!canStartNav()`.
     - Đổi xe lăn hoặc đảo chiều → tính lại tuyến. Không có tuyến xe lăn → thông báo "Không có đường xe lăn giữa hai điểm" và `setRouteOk(false)`.
     - Phòng thủ: tuyến có `wheelchair && pathUsesStairs(...)` → coi như không có tuyến.
   - f. **S3:** `startNavigation` → gọi `startNavMode()` cũ (giữ `_navMode`, `currentStepIdx`, mock). Sau đó camera `flyToPositionTilted` tới **vị trí provider** (nếu không có thì tới node đầu tuyến), bật `follow = true`.
     - Mỗi lần provider cập nhật khi follow → bay theo.
     - `controls` `start` khi S3 → `follow=false`, hiện `#mf-recenter` "Về vị trí của tôi". Bấm → follow lại, ẩn nút.
     - Banner `#mf-nav-text` = `step.text`. Khi `provider.current().lowConfidence` hoặc status `none` → hiện `#mf-lowconf` "Độ tin cậy thấp – chỉ dẫn theo mốc", `#mf-nav-sub` = `landmarkHint(step)`, hiện `#mf-reset-pos` "Đặt lại điểm đứng" (mở picker; chọn xong → tính lại tuyến tới cùng đích, như logic `btn-recalculate`, main.js:844-855).
     - Thanh dưới: `#mf-remaining` = `remainingDistance` "(ước tính)" + `#mf-end` "Kết thúc".
     - Đổi tầng: khi bước hiện tại là chuyển tầng (`step.icon` 🛗/🪜 hoặc floorId node khác `activeFloor`) → `setActiveFloor` + ghi `#mf-live` "Đi thang máy lên Tầng 1" / "Đi cầu thang xuống Tầng trệt", lấy từ `summarizeRoute().transitions`.
     - Đến nơi: dùng trạng thái cũ (`nav-arrived-banner`) hoặc nội dung tương đương trong `#mf-nav-top`, có nút về S0.
   - g. **History:** mỗi `onChange` có `pushed:true` → `history.pushState({mf: state}, '', location.href)`. URL giữ nguyên (không thêm query, không thêm vị trí). `popstate` → `mapFlow.back()` (cờ chống lặp). ✕ / "Kết thúc" / nút quay lại → `history.back()` nếu `history.state?.mf`, ngược lại gọi trực tiếp `mapFlow.back()`. Rời S3 → `exitNavMode()`. Về S0 → `clearRoute()`, `builder.clearHighlight()`.
   - h. **Không crash:** mọi đường đi không có vị trí, không có tuyến, data mẫu (`_isSampleData`), WebGL lỗi đều kết thúc bằng thông báo + lối chọn thủ công. Bọc `try/catch` quanh `checkCampus` và `loadGeofenceConfig`.
9. **README:** thêm mục con, nội dung tối thiểu:
   - chạy `npm run dev:lan` (tương đương `vite --host 0.0.0.0`, tools/dev-lan.mjs:52) hoặc `npm run dev -- --host`;
   - điện thoại cùng Wi-Fi mở `http://<IP>:5173`;
   - luồng S0–S3 chỉ bật ở màn hình ≤700px;
   - **GPS/Geolocation cần HTTPS (secure context)**, nên qua `http://<IP>` GPS và Web Bluetooth không chạy, khi đó dùng chọn thủ công, `?from=<roomId>` hoặc bridge demo;
   - geofence hiện "chưa cấu hình" nên app không hỏi GPS;
   - phương án HTTPS **chưa cài**, đang là câu hỏi mở.
10. **Kiểm thử sau sửa** (mục 9). Lỗi do mình gây ra → sửa và chạy lại.
11. **Báo diff thật** (mục 8.2) và báo cáo (mục 11). Không cập nhật PROJECT_STATUS/HANDOVER/ROADMAP.

## 8. QUY TẮC AN TOÀN

1. **Sao lưu trước khi sửa** (repo chưa commit). Với mỗi file trong 6.3: `cp "<file>" "<file>.bak-2026-11-02"`. Nếu tên đó đã tồn tại → dùng `.bak-2026-11-02b`, **không ghi đè** bản sao lưu nào. Không đụng các `.bak-2026-10-26`.
2. **Diff thật cuối phiên:** với mỗi file sửa: `git diff --no-index --stat "<file>.bak-2026-11-02" "<file>"` và `git diff --no-index "<file>.bak-2026-11-02" "<file>"`. Mã thoát 1 là bình thường khi có khác biệt. Dán `--stat` vào báo cáo. Với file mới: liệt kê đường dẫn + số dòng (`wc -l`).
3. Không cài dependency (không `npm install`, `npx <gói mới>`, mkcert, plugin). Không sửa `dependencies`/`devDependencies`.
4. Không commit/push/deploy. Không lệnh phá hủy (`reset --hard`, `clean -fd`, `rm -rf`).
5. Không sửa dữ liệu phòng/nút/cạnh/beacon (6.3, phần NGOÀI phạm vi). Kiểm tra cuối bằng cách so kích thước/hash trước–sau: ghi `certutil -hashfile <f> SHA256` hoặc `sha256sum` cho `data/rooms.json data/nodes.json data/edges.json data/connectors.json data/floors.json` ở bước baseline và cuối phiên.
6. Giữ nguyên `scan/index.html`, `beacon-admin.html`, `src/beacon-admin/**`, `bench/**`, `vite.config.js`, bố cục kiosk/desktop. Hash trước–sau cho `scan/index.html`, `beacon-admin.html`, `vite.config.js` phải trùng.
7. **Quyền riêng tư:**
   - không lưu, không gửi vị trí người dùng;
   - không ghi tọa độ GPS vào log hay biến toàn cục;
   - không đưa vị trí vào URL/history state;
   - không thêm `localStorage`/`sessionStorage` cho vị trí. Các key cũ `fontSize`, `highContrast`, `wheelchair` là tùy chọn, được giữ.

   Kiểm bằng: `grep -nE "localStorage|sessionStorage|console\.(log|info|warn|error)" src/positioning/position_provider.js src/positioning/geofence.js src/ui/mapFlow.js src/nav/route_summary.js` → không có dòng nào chứa tọa độ/roomId người dùng. Báo nguyên kết quả grep.
8. Không bịa số đo, kết quả test hay ảnh. Không tuyên bố đã chạy trên iPhone hay điện thoại thật.
9. Không vô hiệu hóa test/cảnh báo build để "xanh". Cảnh báo chunk >500 kB là cũ, giữ nguyên.

## 9. KIỂM THỬ

### 9.1 Lệnh (chạy cả baseline lẫn sau sửa, ghi kết quả thật)
```
npm test
npm run build
npm run validate
node --check src/ui/mapFlow.js
node --check src/positioning/position_provider.js
node --check src/positioning/geofence.js
node --check src/nav/route_summary.js
node --check src/main.js
```
- Kỳ vọng: toàn bộ test cũ vẫn đạt (đúng số baseline) cộng test mới đạt; build thành công, `dist/index.html`, `dist/scan/index.html`, `dist/beacon-admin.html` vẫn tồn tại; validate không thêm lỗi so với baseline.
- Không có lint → ghi "không có script lint".
- **Không** chạy hay thêm `tests/streetview.test.mjs` (không nằm trong script, tham chiếu module đã gỡ ở CP0-PHOTO-ALIGN).

### 9.2 Unit test bắt buộc

`tests/map_flow.test.mjs`:
1. S0→S1 (`openSearch`) → S2 (`selectDestination(room,{via:'search'})`) → S3 (`startNavigation` sau `setStart` + `setRouteOk(true)`); rồi `back()` ×3 → S2, S1, S0; `back()` ở S0 vẫn S0.
2. Vào S2 từ chạm bản đồ (`via:'map'`) → `back()` về thẳng S0.
3. **Tự điền điểm đến:** sau `selectDestination`, `context.destination.roomId === room.id`.
4. **Fallback khi không có vị trí:** `autoFillStart(null)` → `start === null`, `canStartNav() === false`, `startNavigation()` không đổi state. Sau `setStart(manual)` + `setRouteOk(true)` → đi được.
5. `autoFillStart` không ghi đè start người dùng đã chọn. `swap()` đổi hai đầu; `swap()` khi thiếu một đầu → không đổi.
6. Chuyển không hợp lệ (S0→`startNavigation`) bị bỏ qua.
7. `summarizeRoute` trên dữ liệu tổng hợp: tuyến F1→F3 qua thang máy → `floorChanges === 2` (nếu đi qua F2) hoặc đúng theo node giả lập; `distanceM` đúng tổng; `transitions[0].type === 'elevator'`.
8. **Xe lăn không có cạnh stairs (dữ liệu thật):** đọc `data/*.json` như tests/ui.test.mjs:8-13, `scopeFloors`, `buildGraph`. Với một phòng F1 làm gốc và **mọi** phòng F2/F3 có `doorNodeId`, chạy `astar(..., {wheelchairOnly:true})`. Mỗi tuyến tìm được: `pathUsesStairs(path, edges) === false`, và mỗi cặp node liên tiếp có ít nhất một cạnh `wheelchairOk === true && type !== 'stairs'`. Khẳng định có ≥1 tuyến đổi tầng (để test có ý nghĩa). Ghi số tuyến đã kiểm.
9. `pathUsesStairs` trả `true` với tuyến tổng hợp có cạnh stairs.
10. `landmarkHint` trả tên phòng khi node là `doorNodeId` của một phòng; trả câu mặc định khi không có.

`tests/geofence_position.test.mjs`:
1. **Geofence 3 trạng thái:** `evaluateGeofence` với polygon tổng hợp (tọa độ giả, ví dụ hình vuông quanh (0,0), **không** dùng tọa độ thật) → điểm trong = `'inside'`, điểm ngoài = `'outside'`; với `data/geofence.json` thật → `'unconfigured'`; polygon < 3 đỉnh → `'unconfigured'`. Circle: trong/ngoài theo bán kính.
2. `checkCampus` với config unconfigured + geolocation giả có bộ đếm → `status:'unconfigured'` và **bộ đếm gọi = 0**.
3. `checkCampus` với `isSecureContext:false` → `'insecure'`, không gọi GPS. `geolocation` undefined → `'unsupported'`. Lỗi `code:1` → `'denied'`, `code:3` → `'timeout'`. Vị trí giả trong/ngoài → `'inside'`/`'outside'`. Kết quả **không** chứa trường tọa độ (`assert.deepEqual(Object.keys(res), ['status'])`).
4. `geofenceMessage('outside')` = "Định vị chỉ hoạt động trong bệnh viện"; `'denied'` chứa "Chưa bật quyền vị trí"; `'unconfigured'` = `null`.
5. **PositionProvider:**
   - chưa có gì → `current() === null`, `isReliable() === false`;
   - `setManual` → reliable, `isUserChosen`;
   - `report(bridge, confidence 0.9)` thắng manual;
   - `markLost('bridge')` → rơi về manual;
   - chỉ có beacon rồi lost → `current().lowConfidence === true`, `isReliable() === false`;
   - quá `STALE_MS` (dùng `now` inject) → hết tin cậy;
   - `confidence 0.3` → không reliable;
   - `subscribe` nhận cập nhật, `unsubscribe` ngừng nhận.
6. Module không động tới storage: chạy trong Node, nơi `localStorage` không tồn tại, không lỗi.

### 9.3 Kiểm tra trực quan
- Executor không có công cụ trình duyệt → ghi đúng câu **"chưa kiểm tra trực quan"**.
- Việc dành cho đội trưởng/verifier nếu có công cụ trình duyệt: `npm run dev`, mở `http://localhost:5173/`, `/?mock=1`, `/?from=F1_R001` ở viewport **430×932** và **375×667**. Chụp ảnh S0, S1 (có kết quả và không kết quả), S2 (có và chưa có điểm xuất phát), S3 (bình thường và độ tin cậy thấp). Kiểm desktop 1440×900 và `?kiosk` không đổi bố cục.
- KHÔNG tuyên bố đã chạy trên iPhone thật.

## 10. DEFINITION OF DONE

Giữ nguyên các mục của người dùng:
- [ ] S0 chỉ còn bản đồ toàn màn hình + ô tìm kiếm + nút tầng + nút vị trí. Panel chỉ đường không xuất hiện trước khi chọn kết quả.
- [ ] Chọn kết quả → khung chỉ đường hiện, điểm đến đã điền sẵn.
- [ ] "Bắt đầu" → camera phóng tới điểm đứng, tuyến được tô tới đích.
- [ ] Mọi trường hợp không có vị trí đều có lối chọn thủ công, không crash.
- [ ] Test/build đạt (có lệnh và kết quả thật). Tính năng cũ vẫn hoạt động.
- [ ] Không cài dependency, không commit/push.

Bổ sung:
- [ ] Toàn bộ test baseline vẫn đạt; 2 file test mới đạt và chạy trong `npm test`, nếu được duyệt sửa scripts.test. Nếu không được duyệt thì chạy riêng bằng `node --test` và ghi rõ.
- [ ] Unit test phủ đủ 9.2: chuyển S0→S1→S2→S3 và quay lui; tự điền điểm đến; fallback khi không có vị trí; geofence trong/ngoài/chưa cấu hình; tuyến xe lăn không có cạnh stairs trên dữ liệu thật.
- [ ] Geofence chưa cấu hình → không gọi geolocation (có test). Không có tọa độ thật hay bịa trong repo.
- [ ] Back của trình duyệt và ✕ đi lùi đúng stack, cuối cùng về S0; URL không chứa vị trí.
- [ ] Mất beacon ở S3 → hiện "Độ tin cậy thấp", giữ tuyến, chỉ dẫn theo mốc, có "Đặt lại điểm đứng".
- [ ] CSS mới chỉ áp dưới `body.mobile-flow`; `mobile-flow` không bật ở kiosk/force2d/glb/màn hình >700px. Hash `scan/index.html`, `beacon-admin.html`, `vite.config.js` và 5 file data không đổi.
- [ ] Chữ ≥16px, input ≥16px, chỉ dẫn ≥20px, vùng chạm ≥48px, có aria-label cho nút biểu tượng, tỉ lệ tương phản đã tính (ghi số).
- [ ] Nhãn "thử nghiệm" vẫn hiện ở S0. Phase 4/6 không bị đánh dấu hoàn thành.
- [ ] README có mục mở trên điện thoại (`--host`, cùng Wi-Fi) và ghi rõ GPS cần HTTPS. Không cài HTTPS.
- [ ] Có bản sao lưu và `git diff --no-index --stat` thật cho mọi file sửa.
- [ ] Kiểm tra trực quan: có ảnh ở 430×932 và 375×667, hoặc ghi "chưa kiểm tra trực quan".

## 11. BÁO CÁO CUỐI (executor gửi đội trưởng)

```
Kết quả: Hoàn thành / Một phần / Chưa
Thay đổi: <file thêm (số dòng) / file sửa (diff --stat) / bản sao lưu>
Kiểm chứng:
  Baseline: npm test → … ; npm run build → … ; npm run validate → …
  Sau sửa:  npm test → … ; npm run build → … ; npm run validate → … ; node --check … → …
  Hash trước/sau: data/*.json, scan/index.html, beacon-admin.html, vite.config.js → …
  grep quyền riêng tư → …
  Tương phản: <cặp màu → tỉ lệ>
  Trực quan: <ảnh> hoặc "chưa kiểm tra trực quan"
Còn lại: <lỗi, giới hạn, giả định, Cần xác nhận>
Tiếp theo: <bước kế>
```
Đề xuất nội dung để đội trưởng ghi vào PROJECT_STATUS.md (checkpoint gợi ý `CP-UI-MOBILE-FLOW`, ngày 2026-11-02, nhãn "Bản thử nghiệm", phase không đổi), HANDOVER.md và ROADMAP.md "Câu hỏi mở". Nội dung **"Cần mang về Claude Chat bàn"** tối thiểu gồm:
1. HTTPS cho điện thoại khi dev (mkcert + Vite `https`, hoặc reverse proxy/HTTPS nội bộ bệnh viện). Chưa cài; cần phê duyệt dependency/công cụ.
2. Tọa độ geofence khuôn viên BV 7A (polygon hay tâm + bán kính), nguồn đo và người xác nhận. Hiện `status: unconfigured`.
3. App native (iOS Core Location / Android) để đọc beacon trên iPhone. Hiện điện thoại chỉ có chọn thủ công, `?from=` và bridge demo qua laptop.
4. Ngưỡng `CONFIDENCE_MIN=0.5`, `STALE_MS=15000`, timeout GPS 8000 ms: Cần xác nhận bằng đo thực.
5. Dữ liệu chưa có trường "khoa" nên tìm theo khoa chưa làm được. Cần schema ở Phase 3.
6. `ble_adapter` chưa trả confidence; đang gán 1 (Cần xác nhận).

---

# CẦN NGƯỜI DÙNG QUYẾT

1. **Luồng mới áp dụng ở đâu?** Đề xuất mặc định: chỉ màn hình ≤700px, không kiosk, không `?force2d`, không `?model=glb`. Desktop và kiosk giữ luồng cũ (side-panel, room-sheet, nút nav cũ). Phương án khác: áp cho mọi kích thước. Rủi ro: đổi bố cục kiosk/desktop, trái với ràng buộc "không làm hỏng bố cục kiosk".
2. **Có cho sửa `package.json` dòng `scripts.test` để thêm `tests/map_flow.test.mjs tests/geofence_position.test.mjs` không?** Đề xuất mặc định: CÓ, chỉ nối thêm, không đổi gì khác (đã có tiền lệ ở CP-BENCH-TOOL, CP-WEBGL-ROOTCAUSE). Nếu KHÔNG: executor chạy 2 file bằng `node --test` riêng, `npm test` giữ nguyên.
3. **File cấu hình geofence đặt ở đâu và theo định dạng nào?** Đề xuất mặc định: `data/geofence.json`, `status: "unconfigured"`, hỗ trợ `polygon` ([lat,lng] ≥3 đỉnh) hoặc `circle` (`center` + `radius_m`); app không gọi GPS khi chưa cấu hình. Phương án khác: `public/config/geofence.json`, được `vite build` sao chép chắc chắn vì `publicDir: 'public'`. Việc `/data/*.json` có trong bản build hay không là Cần xác nhận, áp dụng cho mọi file data hiện có.

(Các giả định khác đã ghi ở mục 6.1 và đổi được khi duyệt: chạm phòng ở S0 → vào S2; nhãn "Thử nghiệm" nằm trong pill; không hiện thời gian; bridge demo trong bộ chọn điểm xuất phát.)

---

# NGUỒN

**File đã đọc (file:dòng):**
- `ROADMAP.md`: 6 (phase hiện tại), 93-107 (Phase 4), 111-126 (Phase 5), 130-144 (Phase 6, DoD xe lăn), 238-265 (Câu hỏi mở)
- `PROJECT_STATUS.md`: 62-101 (CP-NAV-BLE), 132-156 (CP-DEV-LAN), 392-419 (CP-THREE-FLOOR-UI), 443-450 (phê duyệt làm UI ngoài phase)
- `HANDOVER.md`: 53-109 (CP-NAV-BLE), 134-149 (dữ liệu provisional), 152-163 (HTTPS là câu hỏi mở)
- `docs/WORKFLOW.md`: 31-45 (vòng /hin), 47-82 (mẫu prompt)
- `package.json`: 9-17 (scripts), 18-23 (deps)
- `index.html`: 46-65 (header/search), 67-126 (side-panel), 128-164 (canvas, nav overlay), 170-179 (room-sheet)
- `src/main.js`: 24-30 (URL params), 108 (simPosition), 138/165-167/227 (scene, controls, posMarker), 305-335 (pointer/tap), 343-412 (resize, camera, fly), 453-523 (_buildScene, ?from), 557-615 (loadAll), 753-1032 (initUI), 1035-1041 (showMain), 1052-1074 (setActiveFloor), 1141-1166 (selectRoom/sheet), 1180-1230 (findRoute), 1277-1290 (clearRoute), 1345-1358 (position status), 1400-1426 (BLE), 1431-1522 (nav mode), 1526-1575 (bridge), 1580-1608 (mock)
- `src/ui/wayfinding.css`: 126-174, 185-199, 203-293
- `src/ui/hospital-theme.css`: 14-61, 131-185 (cỡ chữ 12px phổ biến)
- `src/styles.css`: 133-134, 223, 378, 423-424, 529-534, 540
- `src/search/search.js`: 5-12, 14-79
- `src/nav/astar.js`: 63-97 (lọc wheelchairOk ở 85)
- `src/nav/instructions.js`: 6-81
- `src/positioning/bridge_source.js`: 13-93
- `src/beacon-admin/sources.js`: 1-40, 125
- `src/scene/PositionMarker.js`: 1-40
- `tests/ui.test.mjs`: 1-50
- `vite.config.js`: 1-94 (relay localhost-only ở 26; publicDir ở 67)
- `tools/dev-lan.mjs`: 52 (vite --host 0.0.0.0)
- `tools/validate_data.mjs`: 28-35 (chỉ đọc 8 file cố định, thêm geofence.json không ảnh hưởng)
- `data/rooms.json`: 1-30 (không có trường khoa); `data/edges.json`: 1-25, 152-154 (stairs `wheelchairOk:false`); grep: 59 cạnh stairs/elevator; không có file geofence nào
- `README.md`: 104-139

**URL đã tra:**
- Geolocation chỉ chạy trong secure context: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
- Mã lỗi Geolocation 1/2/3 (PERMISSION_DENIED/POSITION_UNAVAILABLE/TIMEOUT): https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError/code
- localhost/127.0.0.0/8 là secure context; IP LAN qua http thì không: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts
- Web Bluetooth: chỉ secure context, thử nghiệm: https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
- Safari iOS/desktop không hỗ trợ Web Bluetooth gốc: https://caniuse.com/web-bluetooth
- iBeacon trên iOS qua Core Location (ranging): https://developer.apple.com/documentation/corelocation/ranging-for-beacons. Trang chỉ trả được tiêu đề; chi tiết API: Cần xác nhận.
- `env(safe-area-inset-*)`: https://developer.mozilla.org/en-US/docs/Web/CSS/env
- WCAG 2.2 AA tương phản 4.5:1 / 3:1: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- iOS Safari tự phóng to khi input < 16px: **Cần xác nhận**. Chưa tìm được tài liệu chính thức của Apple; giữ yêu cầu ≥16px theo yêu cầu người dùng.
- Vùng chạm ≥48px là yêu cầu dự án. WCAG 2.2 AA (2.5.8) chỉ yêu cầu 24px; con số 48px không dựa trên chuẩn WCAG nào.
