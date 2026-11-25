# HANDOVER

## CP-BEACON-PLACE-3D (2026-11-09) — Gán beacon trực tiếp trên bản đồ 3D

### Đã làm
- Chế độ "Gán beacon" (xem PROJECT_STATUS.md và `docs/agent-runs/2026-11-09-1031-gan-beacon-3d.md`). Prompt đã duyệt: `docs/prompts/2026-11-09-beacon-placement-3d-v2.md`. Mặc định: dùng danh sách beacon có sẵn trong `data/beacons.local.json`; chỉ lưu tọa độ + tầng.
- Gộp hướng Plan A (marker beacon trên bản đồ); Plan A cũ và nháp v2 vẫn nằm trong `docs/prompts/`.

### Việc cần người dùng
1. `npm run dev` → bật "Gán beacon" (xem HUONG_DAN.md mục 13) → chọn một tầng → chạm đặt F1_B01 → kiểm marker. Nên thử trên bản sao `beacons.local.json` trước.
2. Đối chiếu vị trí marker với chỗ gắn thật (D6).
3. Không chép file `data/beacons.local.json.bak-<ngày>` đi nơi khác (chứa UUID thật; đã gitignore).

### Giới hạn / Cần xác nhận
- Chưa kiểm trực quan trình duyệt; không có kéo thả marker; chỉ gán ở chế độ một tầng; "Gỡ" đặt x/z = null.
- Hướng trục z; số tầng thực dựng (3 hay 9) — chưa rõ.
- `src/beacon-admin/main.js` fetch `/data/beacons.local.json` nên dev server (kể cả `dev:lan`) phục vụ file có UUID qua HTTP: cần quyết riêng.
- Reviewer "Nên sửa": dọn group cũ ở `BeaconLayer.js:24-31`; fallback byte-length ở `beacon_placement.js:164-166`.

### Cần mang về Claude Chat
- Chốt hướng trục z và số tầng dựng; cách xử lý rủi ro `beacon-admin` + dev:lan; có làm kéo thả marker/gắn roomId (Plan B, Phase 5) không.

## CP-BEACON-MAP-PLAN (2026-11-02) — Plan beacon thật lên bản đồ 3D (chờ duyệt)

### Đã làm
- Khảo sát code (explorer + lead đối chiếu): marker hiện chỉ đặt theo door node của phòng, không nhận tầng; admin và app chính dùng hai adapter khác nhau; trạng thái beacon nằm trong DOM-bound `beacon-admin/main.js`.
- Viết plan A/B: `docs/prompts/2026-11-02-beacon-map-plan.md`. Thêm Q30–Q35 vào ROADMAP.md. Không sửa mã.

### Việc cần người dùng
- Duyệt (hoặc chỉnh) Plan A tại Cổng 1; trả lời Q30–Q34 nếu muốn chốt sớm (không chặn A trừ Q30/Q34 có thể đổi cách làm).
- B chỉ bắt đầu sau Cổng 2 và khi cho phép chạm Phase 5.

### Giả định / Cần xác nhận
- Tọa độ F1_B01 có thể là tạm; ngưỡng timeout/hysteresis/cửa sổ đều "Cần xác nhận"; Burn chưa biết; rssiAt1m chưa đo.

## CP-UI-MOBILE-FLOW (2026-11-02) — Luồng di động kiểu Google Maps (Bản thử nghiệm)

### Đã làm
- Xem bảng file ở PROJECT_STATUS.md (CP-UI-MOBILE-FLOW). Prompt đã duyệt: `docs/prompts/2026-11-02-mobile-map-flow.md`.
- Quyết định áp dụng (mặc định): mobile-flow chỉ ≤700px, không kiosk/force2d/glb; sửa `scripts.test`; geofence ở `data/geofence.json`.
- Chạm phòng ở S0 → vào S2; nhãn "Thử nghiệm" nằm trong ô tìm kiếm; không hiện thời gian đi, chỉ khoảng cách "(ước tính)" + số lần đổi tầng; bridge demo nằm trong bộ chọn điểm xuất phát.
- Vị trí chỉ giữ trong bộ nhớ; không đưa vào URL/history; không log tọa độ.

### Giả định
- Vị trí tin cậy: thủ công/URL luôn tin cậy; beacon cần confidence ≥ 0,5 và tuổi ≤ 15 s (Cần xác nhận).
- `ble_adapter` gán confidence = 1 (Cần xác nhận).
- Geofence chưa cấu hình → bỏ qua GPS hoàn toàn.

### Lỗi/giới hạn còn
- Đã kiểm tra trực quan trong trình duyệt tích hợp (430×932, 375×667, 1440×900, `?kiosk=1`: kiosk giữ nguyên, mobile-flow tắt); chưa kiểm bằng mắt S3 độ tin cậy thấp và `?from=`; chưa chạy trên điện thoại thật. **Việc tiếp theo:** (còn lại từ danh sách cũ) `npm run dev`, mở devtools mobile 430×932 và 375×667, thử `/`, `/?mock=1`, `/?from=F1_R001`; xem S0, S1 (có/không kết quả), S2 (có/chưa có điểm xuất phát), S3 (thường/độ tin cậy thấp); kiểm desktop và `?kiosk` không đổi.
- Các giới hạn khác: xem PROJECT_STATUS.md (mục Còn lại).

### Cần mang về Claude Chat bàn
1. HTTPS cho điện thoại khi dev (mkcert + Vite https, hoặc reverse proxy/HTTPS nội bộ): chưa cài, cần duyệt công cụ. GPS và Web Bluetooth không chạy qua http://<IP LAN>.
2. Tọa độ geofence khuôn viên BV 7A (polygon hay tâm + bán kính), nguồn đo, người xác nhận. Hiện `unconfigured`.
3. App native (iOS Core Location / Android) để đọc beacon trên iPhone; hiện điện thoại chỉ có chọn thủ công, `?from=`, bridge demo qua laptop.
4. Ngưỡng CONFIDENCE_MIN, STALE_MS, timeout GPS: cần đo thực.
5. Dữ liệu chưa có trường "khoa": cần schema ở Phase 3.
6. `ble_adapter` chưa trả confidence.

---

## CP-tool.2 (2026-11-02) — Lệnh điều phối /hin (phần 2/2)

### Đã làm
- Tạo `.claude/commands/hin.md` (nguyên văn theo prompt) và `docs/prompts/.gitkeep`.
- `CLAUDE.md` mục 1: thêm vai "Đội thực thi trong Claude Desktop"; Antigravity không còn là "nơi duy nhất thực thi" mà là "thực thi ở Antigravity hoặc qua hin-executor". Các mục khác giữ nguyên.
- `docs/WORKFLOW.md`: thêm mục "Vòng lặp trong Claude Desktop (/hin)". Vòng lặp Chat ↔ Antigravity giữ nguyên.

### Cách dùng /hin
1. Mở **phiên Claude Code mới** trong thư mục dự án (để nạp `.claude/agents/` và `.claude/commands/`).
2. Gõ `/hin <yêu cầu ngắn>`, ví dụ: `/hin Rà ROADMAP và đề xuất bước đầu Phase 0`.
3. Đội trưởng gọi `hin-planner`, lưu prompt vào `docs/prompts/<YYYY-MM-DD>-<slug>.md`, trình prompt rồi **dừng ở cổng duyệt**.
4. Đọc prompt. Đồng ý → gõ đúng `HÃY THỰC THI PROMPT NÀY`. Muốn sửa → gõ góp ý; planner soạn lại và lưu thành file mới.
5. Sau khi duyệt: `hin-executor` thực thi → `hin-verifier` kiểm độc lập (tối đa 2 vòng sửa) → đội trưởng cập nhật PROJECT_STATUS/HANDOVER và báo cáo.

### Việc còn lại
- Chạy thử `/hin` lần đầu (ví dụ trên). Kỳ vọng: dừng ở cổng duyệt, có file mới trong `docs/prompts/`. Chưa chạy, **Cần xác nhận**.
- Gọi thử chỉ đọc `hin-planner` và `hin-verifier` (việc còn lại của CP-tool.1).

### Cần mang về Claude Chat bàn
- Quy tắc đặt tên checkpoint `CP<phase>.<số>` trong WORKFLOW.md không bao gồm việc về công cụ; hiện đang dùng `CP-tool.N`. Có cần ghi quy ước này vào WORKFLOW.md không?
- Phân vai hiện có hai đường lập prompt: Chat và `/hin` (ngay trong Claude Code). Cần quyết khi nào dùng Chat, khi nào dùng `/hin` (ví dụ: quyết định kiến trúc vẫn mang về Chat).
- `hin-planner` có WebSearch/WebFetch (câu hỏi từ CP-tool.1, vẫn mở).
- File prompt trong `docs/prompts/` có nên commit vào Git (lưu vết) hay đưa vào `.gitignore`?

---

## CP-tool.1 (2026-11-02) — Đội subagent trong Claude Code (phần 1/2)

### Đã làm
- Tạo `.claude/agents/hin-planner.md`, `.claude/agents/hin-executor.md`, `.claude/agents/hin-verifier.md`, nội dung nguyên văn theo prompt đã duyệt (planner: chỉ đọc + tra web; executor: sửa file/chạy lệnh trong phạm vi; verifier: chỉ đọc + chạy kiểm tra).
- Không có file cũ bị ghi đè (thư mục `.claude/agents/` trước đó chưa tồn tại).
- Không sửa CLAUDE.md, docs/, `.claude/commands/`, `.claude/settings.json`. Phase dự án không đổi (Chuẩn bị → chờ Phase 0).

### Kiểm chứng
- Frontmatter cả 3 file mở/đóng bằng `---`, `name` khớp tên file.
- Gọi thử `hin-planner` và `hin-verifier` trong phiên tạo file → "Agent type ... not found". **Cần xác nhận: Claude Desktop chưa nạp .claude/agents** (agent được nạp khi mở phiên).

### Việc còn lại
1. Mở phiên Claude Code mới, gọi thử lại (chỉ đọc):
   - hin-planner: "Phase hiện tại và DoD Phase 0 là gì? Không soạn prompt."
   - hin-verifier: "Chạy git status, báo kết quả, không sửa gì."
2. **Phần 2/2:** tạo lệnh điều phối `/hin` (`.claude/commands/`) và sửa tài liệu (CLAUDE.md §1 phân vai, docs/WORKFLOW.md) cho mô hình đội thực thi trong Claude Code.

### Cần mang về Claude Chat bàn
- Soạn prompt phần 2: luồng `/hin` (planner → người dùng duyệt → executor → verifier → đội trưởng cập nhật PROJECT_STATUS/HANDOVER), điểm dừng chờ duyệt, xử lý khi verifier KHÔNG ĐẠT.
- Sửa CLAUDE.md §1: hiện ghi "Claude Code trong Antigravity", trong khi đội chạy trong Claude Desktop — cần chốt cách diễn đạt.
- `hin-planner` có WebSearch/WebFetch: xác nhận có chấp nhận việc gửi truy vấn ra ngoài (không chứa dữ liệu nhạy cảm) hay không.

---

## CP-NAV-BLE (2026-11-02)

### Đã làm

**Task 0 (Survey):** Xác nhận: Three.js 3D viewer (F1/F2/F3, OrbitControls, RouteRenderer, PositionMarker), A* tại `src/nav/astar.js` (`buildGraph` + `astar`), bridge.py WebSocket `ws://127.0.0.1:8765`, Vite multi-page build với plugin hook `configureServer`.

**Task 1 – LocationSource 3 nguồn:**
- Manual pick: prompt "Bạn đang ở đâu?" khi không có vị trí
- URL `?from=<roomId>`: alias cho `?at=`, dùng `params.get('from') ?? params.get('at')`
- BLE bridge: `BridgeSource` polling `/api/loc/poll?code=XXXXXX`; dán nhãn "Vị trí từ máy quét (demo)"; không lưu/log vị trí

**Task 2 – Hiển thị vị trí:** `PositionMarker` marker xanh; tự chuyển tầng; `flyToPositionTilted()` fly ~50° tilt; không có vị trí → hỏi, không đoán.

**Task 3 – Tìm đường:** Dùng A* có sẵn. Vẽ 3D route với arrow. Wheelchair option nếu `wheelchairOk`. Nếu thiếu data → hiển thị "Chưa có dữ liệu đường đi" (không crash).

**Task 4 – Nav mode:**
- Banner lớn step-by-step (`_updateNavBanner`)
- "Về vị trí" button fly camera về marker
- "Tôi đã tới mốc này" tăng step
- Off-route detection `OFF_ROUTE_THRESHOLD_M=8` (Cần xác nhận) → banner "Tính lại"
- Banner đến nơi
- Tất cả khoảng cách/thời gian ghi nhãn "ước tính"

**Task 5 – Laptop→phone relay:**
- Vite plugin `loc-relay` với 3 endpoint: `POST /api/loc/new-code`, `POST /api/loc/push` (localhost-only, 403 nếu không phải 127.0.0.1), `GET /api/loc/poll`
- Scan page (`scan/index.html`): RSSI sliding window 5 mẫu, strongest beacon, hysteresis N=3, pairing code 6 chữ số
- Gửi `{roomId, floorId, confidence, timestamp}` — không gửi thêm gì
- Timeout → "Mất tín hiệu – chọn mốc thủ công"

**Task 6 – Mock mode:** `?mock=1` → badge đỏ MOCK → phát chuỗi phòng theo tuyến thật với `setInterval`.

### Kiến trúc relay (quan trọng)

iPhone Safari không thể truy cập `ws://127.0.0.1:8765` (bridge.py). Giải pháp: Vite plugin thêm HTTP relay middleware. Scan page (laptop browser) kết nối bridge.py → xử lý beacon → POST đến `/api/loc/push` (localhost-only). Phone poll `/api/loc/poll?code=`. In-memory Map, không persistence, không logging vị trí.

### Câu hỏi mở

1. **Ngưỡng cần xác nhận bằng đo thực:**
   - `POLL_INTERVAL_MS=2000` ms — có thể tăng để giảm traffic
   - `SIGNAL_TIMEOUT_MS=15000` ms — nên bao nhiêu trước khi hiển thị "Mất tín hiệu"?
   - `OFF_ROUTE_THRESHOLD_M=8` m — ngưỡng lệch đường tính lại
   - `RSSI_THRESHOLD=-80`, `HYSTERESIS_COUNT=3`, `WINDOW_SIZE=5` trong scan page
2. **beacon-map.json:** hiện dùng UUID `00000001-...` placeholder. Cần điền UUID thật sau khi chạy bridge.py với beacon thật.
3. **Test case a–h:** cần kiểm thử trực quan trên thiết bị viewport 430×932. Xem HUONG_DAN.md §12.
4. **HTTPS:** relay dùng HTTP — phone polling qua LAN `http://`. Nếu cần HTTPS (để Web Bluetooth / camera hoạt động), cần `mkcert` + Vite `https:true` — mang về Chat bàn trước.

### File đã tạo/sửa

| File | Thay đổi |
|---|---|
| `vite.config.js` | Thêm `loc-relay` Vite plugin (3 HTTP endpoint, in-memory Map) |
| `src/positioning/bridge_source.js` | MỚI — BridgeSource class |
| `index.html` | Thêm `btn-start-nav`, `#nav-mode-overlay`, bridge-section UI |
| `src/ui/wayfinding.css` | Thêm ~80 dòng CSS nav mode + bridge |
| `src/main.js` | 7 function mới, fix `?from=`, fix Rollup parse error |
| `scan/index.html` | Thêm bridge relay section (RSSI, pairing, push) |
| `HUONG_DAN.md` | Thêm §12 "Hướng dẫn chạy demo" (5 kịch bản A–E) |

---

## CP0-FLOORPLAN-STRATEGY (2026-11-02)

**Đã xác nhận thứ tự ưu tiên nguồn mặt bằng — 2026-11-02:**

| Phương án | Nguồn | Vai trò |
|-----------|-------|---------|
| A | Sơ đồ thoát nạn PCCC treo tường | Đối chiếu, kiểm tra thay đổi — **chỉ chụp khi bệnh viện cho phép** |
| B | Bản vẽ kỹ thuật DWG/PDF (hoàn công kiến trúc) | Dùng để dựng mô hình 3D và chạy pipeline |
| C | Đo thực địa bằng thước laser | Dự phòng khi A và B không khả thi |

**Nguyên tắc kết hợp:** Nếu có cả A và B → dùng B để dựng, A để đối chiếu chéo.

**Trạng thái hiện tại:**
- Phương án A: **Chờ bệnh viện cho phép** — chưa có ai đồng ý chụp
- Phương án B: Chưa tiếp cận bộ phận kỹ thuật
- Phương án C: Chưa cần

**Câu hỏi mở:** Q25 trong ROADMAP.md — chờ bệnh viện xác nhận quyền chụp sơ đồ PCCC.

---

## CP0-DATA-CORRECTION (2026-11-02)

**Phát hiện quan trọng từ Claude Chat — ảnh hưởng toàn bộ dữ liệu phòng F1/F2:**

1. **`data/rooms.json` F1 sinh từ sơ đồ mẫu**, không phải mặt bằng BV Quân y 7A. File nguồn là `assets/floorplans/sodobenhvienmau.jpg` — bố cục văn phòng tổng quát, không phản ánh thực tế bệnh viện.
2. **F2 là bản sao y hệt F1**: diff SVG sau chuẩn hóa tên tầng = 0 dòng. Tất cả 42 phòng F2 có cùng tên, type, bounds, centroid như F1.
3. **Hệ quả**: 6 phát hiện trong `data/survey/photo_findings.json` **không gán được roomId** vào dữ liệu phòng hiện tại. Ứng viên giếng trời F2_R013 không có giá trị.

**Trạng thái dữ liệu phòng hiện tại: `provisional – sơ đồ mẫu`**
- Tên phòng như "Phòng Trưởng ban", "Phòng Hành chính", "Trung Tâm dữ liệu" là tên template, **không xác nhận tên thật** tại BV 7A.
- Geometry (bounds, centroid) là tạm thời, cần thay bằng mặt bằng thật.

**Câu hỏi mở — việc cần làm trước khi gán phòng:**
- Lấy mặt bằng thật tầng 1 và tầng 2: bản vẽ kiến trúc (DWG/PDF) hoặc sơ đồ thoát nạn PCCC treo tường.
- Sau khi có mặt bằng thật: chạy lại pipeline `tools/build_floor.py` với ảnh mặt bằng thật, regenerate `data/rooms.json`, rồi mới gán roomId cho các findings.

---

## CP-DEV-LAN (2026-11-02)

**Đã làm:** Tạo `tools/dev-lan.mjs` — script Node built-in only. Lấy IPv4 LAN qua `os.networkInterfaces()` (bỏ qua adapter ảo: vEthernet/WSL/VirtualBox/Docker), in khối Local+Network trước khi spawn, rồi spawn `vite --host 0.0.0.0` với `shell:true`. Thêm script `"dev:lan": "node tools/dev-lan.mjs"` vào package.json (chỉ thêm 1 dòng, không sửa script `dev`). Thêm mục "Truy cập từ điện thoại khi dev" vào README.md (mục mới, không xóa nội dung cũ).

**Kiểm chứng thực tế:** `node --check` → OK; chạy thực tế in `Network: http://172.16.29.100:5173`; vite log `Network: http://172.16.29.100:5175/` xác nhận `--host 0.0.0.0`; curl LAN IP → HTTP 200; 103/103 tests pass; `dev` script không đổi; không dependency mới.

**Cần người dùng xác nhận:** Mở `http://172.16.29.100:<port>` trên điện thoại cùng Wi-Fi → xem bản đồ 3D có hiện không.

### Cần mang về Claude Chat bàn

1. **(1) HTTPS khi dev cho AR/camera/la bàn:** Truy cập `http://<IP>` không phải secure context → Web Bluetooth (quét beacon), camera (AR), cảm biến hướng đều bị chặn trên điện thoại. Có cần bật HTTPS cho dev không? Phương án: `mkcert` tạo cert local, Vite `https:true`. Cần quyết định và phê duyệt trước khi thực hiện.
2. **(2) Chênh lệch tài liệu vs. prototype:** ROADMAP ghi "Phase hiện tại: Phase 0 – Khảo sát & chốt yêu cầu", nhưng prototype thực tế (CP-DEV-LAN, CP0-STREETVIEW-PROTO, CP-BEACON-BRIDGE...) đã vượt xa Phase 0. Bảng theo dõi tiến độ ghi "Prototype P0.5 – Hoàn thành". Tài liệu đang theo dõi đúng trạng thái thực, không cần sửa phase — nhưng cần xác nhận để tránh nhầm lẫn khi bàn.

---

## CP0-SURVEY-SVG (2026-11-02)

### Đã làm

1. **`tools/gen_floor_svg.py`** — script Python (standard-lib only) xuất SVG mặt bằng tầng. Mỗi phòng có viền + nhãn "ID – tên", tô màu theo type, landmark tô cam/viền đỏ. Có thước 5 m, mũi tên X (Đông) / Z (Nam), tiêu đề.
2. **`docs/survey/F1.svg`** — 42 phòng F1, F1_R013 tô màu (cụm 3 thang máy).
3. **`docs/survey/F2.svg`** — 42 phòng F2, F2_R013 tô màu (ứng viên giếng trời — **vô hiệu**, xem §CP0-DATA-CORRECTION).
4. **`data/survey/photo_findings.json`** — 6 phát hiện từ ảnh khảo sát.
5. **F1_R013 ghi chú**: Schema `rooms.json` không có trường ghi chú/note → KHÔNG thêm field mới. Ghi chú "3 cửa thang máy (PH_008)" chỉ trong FIND_003.

### Ứng viên giếng trời F2 — **VÔ HIỆU**

~~F2_R013~~ — **Không có giá trị**: F2 là bản sao y hệt F1 (dữ liệu mẫu). Mọi "trùng khớp bounds" chỉ phản ánh việc sao chép, không phản ánh mặt bằng thực. Xem §CP0-DATA-CORRECTION.

### Trạng thái 6 phát hiện

> **Lưu ý:** Dữ liệu phòng F1/F2 là provisional – sơ đồ mẫu. Tất cả 6 phát hiện ở trạng thái "chưa gán phòng" cho đến khi có mặt bằng thật.

| ID | Hạng mục | Floor | Ảnh | roomId | Status |
|----|----------|-------|-----|--------|--------|
| FIND_001 | Quầy tiếp tân | F1 | PH_001, PH_002 | null | **chưa gán** |
| FIND_002 | Kiosk/Điểm thông tin | F1 | PH_005 | null | **chưa gán** |
| FIND_003 | Cụm 3 cửa thang máy | F1 | PH_008 | null (gán tạm F1_R013 vô hiệu) | **chưa gán** |
| FIND_004 | Khoa Dược | F2 | PH_009 | null | **chưa gán** |
| FIND_005 | Lan can kính/Giếng trời | F2 | PH_010, PH_012 | null (ứng viên F2_R013 vô hiệu) | **chưa gán** |
| FIND_006 | Biển LỐI THOÁT/EXIT | F2 | PH_012 | null (vật cản, không phải phòng) | **chưa gán** |

### Cần mang về Claude Chat bàn

1. **Lấy mặt bằng thật** tầng 1 và tầng 2 (bản vẽ kiến trúc DWG/PDF hoặc sơ đồ thoát nạn PCCC). Đây là điều kiện tiên quyết trước mọi bước gán phòng.
2. **SVG hiện tại** (`docs/survey/F1.svg`, `docs/survey/F2.svg`) dựa trên dữ liệu mẫu — chỉ dùng để tham khảo cấu trúc script, **không dùng để khoanh vị trí** cho đến khi có mặt bằng thật.
3. **FIND_006 (biển EXIT):** Quyết định có thêm vào graph dẫn đường không (node EXIT/landmark) — độc lập với việc có mặt bằng thật hay chưa.
4. **PH_013–015:** Vẫn chưa xác định tầng (F2 hay F3). Cần ảnh bổ sung hoặc xác nhận thực địa.
5. **Sau khi có mặt bằng thật:** chạy lại pipeline → regenerate rooms.json → mới chạy gen_floor_svg.py → mới khoanh roomId.

---

## CP0-PHOTO-ALIGN (2026-11-02)

### Phần A — Đã làm: Gỡ tính năng "Đi theo ảnh"

**File đã xóa:**
- `src/streetview/StreetView.js`, `src/streetview/streetview.css` (toàn bộ thư mục)
- `data/routes.json`, `data/layout-schematic.json`
- `docs/mobile-testing.md`

**File đã sửa:**
- `index.html`: xóa `<link>` streetview.css, xóa `<button id="nav-streetview">`, xóa toàn bộ `<div id="streetview-panel">` + comment
- `src/main.js`: xóa `import { StreetView }` + block `// Street view` (14 dòng)

**Giữ nguyên:** `data/photo-nodes.json`, `docs/photo-survey.md`

**Kiểm chứng:** `npm test` → 103/103 PASS | `npm run build` → OK (774KB/203KB gzip)

---

### Phần B — Bảng đối chiếu ảnh vs. sơ đồ 3D (chờ duyệt)

**Ánh xạ floorId:**
- photo `F1` = viewer `F1` = Tầng trệt (elevation 0m)
- photo `F2` = viewer `F2` = Tầng 2 (elevation 3.6m)
- PH_013–015: ghi nhận "không xác định F2 hay F3" → bỏ qua

**Bảng đối chiếu:**

| Tầng | Hạng mục | Sơ đồ 3D hiện tại | Ảnh cho thấy | Độ tin cậy | Đề xuất sửa |
|------|----------|-------------------|--------------|------------|-------------|
| F1 | Quầy tiếp tân | Không có (F1_R001–042 không có room tên tiếp tân/entrance) | PH_001, PH_002: backdrop viền vàng-trắng, chữ "BV Quân y 7A" rõ | **Chắc chắn** (tồn tại) | Đặt tên 1 phòng F1 → "Quầy tiếp tân". **Chưa biết room ID** vì x/z=null |
| F1 | Thang máy (số buồng) | F1_R013: "Thang máy / Giếng trời" (1 phòng) | PH_008: **3 cửa thang máy** liền kề, cột '3' | **Chắc chắn** (3 cửa) | Cập nhật ghi chú F1_R013. Type đã đúng; không đổi cấu trúc |
| F1 | Kiosk sức khỏe | Không có | PH_005: kiosk trắng-đỏ tại sảnh | Chắc chắn (tồn tại) | Chưa biết room ID |
| F2 | Khoa Dược | Không có (F2_R001–042 không có tên này) | PH_009: backdrop nâu-vàng **"Khoa Dược / Department of Pharmacy"** rõ | **Chắc chắn** (tồn tại trên F2) | Đặt tên 1 phòng F2 → "Khoa Dược". **Chưa biết room ID** vì x/z=null |
| F2 | Lan can kính / Void | Không có void/atrium trong sơ đồ | PH_010, PH_012: lan can kính bên phải, nhìn xuống khu chờ F1 | **Chắc chắn** (void tồn tại) | Sơ đồ thiếu void. Không sửa được mà không có tọa độ thực |
| F1 | WC | F1_R007/008: WC Nam/Nữ (đã có) | PH_015: "Nhà Vệ Sinh" nhưng floorId không chắc (F2 hay F3) | Không xác định floorId | Bỏ qua |
| F1 | Cầu thang | F1_R012/039/041 (đã có) | PH_003: ước lượng, không rõ | Ước lượng | Bỏ qua |

**Giới hạn:** Tất cả photo-nodes có x/z=null → không thể khớp ảnh sang room ID cụ thể. Chỉ xác nhận được *sự tồn tại*, không xác nhận được *vị trí* mà không có sơ đồ mặt bằng hoặc đo thực địa.

**Câu hỏi mở → mang về Claude Chat (quan trọng):**
1. Phòng nào trên F1 là quầy tiếp tân? (cần bản vẽ hoặc ước lượng vị trí từ chủ dự án)
2. Phòng nào trên F2 là Khoa Dược?
3. Có void/atrium nối F1–F2 ở khu nào, kích thước bao nhiêu?
4. Có thể cập nhật `F1_R013` note "3 cửa thang máy" ngay mà không cần tọa độ — được phép không?
5. PH_013–015 thuộc F2 hay F3? Cần ảnh bổ sung hoặc xác nhận thực địa.

---

## CP0-STREETVIEW-PROTO (2026-11-02)

**Đã làm:** Dựng nguyên mẫu street view (Phương án B) tích hợp vào app hiện có. Không cài thêm dependency nào. 121/121 tests pass. Dev server LAN: `http://172.16.29.100:5173/`.

**Kiến trúc thực thi:**
- `StreetView` là một ES module (`src/streetview/StreetView.js`) tự chứa, khởi tạo lazy khi user nhấn "Đi theo ảnh" lần đầu.
- Minimap dùng một **instance Map2D riêng** (không share state với Map2D 3D-viewer hiện có) để tránh xung đột.
- 3D scene (Three.js) **không bị chạm** — overlay street view là `position:fixed` layer riêng biệt.
- Privacy filter: node có `privacy.faces=true` hoặc `privacy.screensOrDocs=true` → hiện placeholder thay vì ảnh gốc.

**Giới hạn cần giải quyết:**
1. **`assets/survey-photos/` chưa có ảnh** — cần di chuyển 15 ảnh gốc từ temp vào repo (đặt tên `001.jpg`–`015.jpg`). Sau đó các node không-privacy sẽ hiện ảnh thật.
2. **Tuyến bị đứt**: PH_006–009 (unverified) → không có đường từ Sảnh lên Tầng 1 đã xác nhận. Cần trả lời Q20–Q24 và chụp thêm ảnh.
3. **Minimap tọa độ schematic** — khi có sơ đồ mặt bằng thực tế, cập nhật `data/layout-schematic.json` với tọa độ thật (đơn vị mét).
4. **Tìm kiếm**: chức năng tìm kiếm trong StreetView dùng `_normalizeViet` riêng, không phụ thuộc module `search.js` — nếu sau này muốn đồng nhất thì import từ `src/search/search.js`.

**File mới/sửa trong phiên này:**
```
data/photo-nodes.json        ← thêm trường verified (true/false)
data/layout-schematic.json   ← MỚI: tọa độ schematic 15 node
data/routes.json             ← MỚI: 2 segment verified
src/streetview/StreetView.js ← MỚI: component chính
src/streetview/streetview.css← MỚI: styles mobile-first
index.html                   ← thêm CSS link, nav button, panel HTML
src/main.js                  ← thêm import StreetView + wire-up
tests/streetview.test.mjs    ← MỚI: 18 test cases
docs/mobile-testing.md       ← MỚI: checklist 10 mục
```

**Việc tiếp theo (Claude Code):**
- Di chuyển 15 ảnh vào `assets/survey-photos/001.jpg`–`015.jpg` (sau khi user cho phép)
- Cập nhật `data/photo-nodes.json` sau khi xác nhận Q20–Q24 về tầng/lối chuyển
- Thêm loading state khi ảnh 404 (hiện đã graceful nhưng chưa có spinner trên `#sv-photo`)

**Việc cần mang về Claude Chat:**
- Quyết định layout thực tế cho `data/layout-schematic.json` (sau khi có bản vẽ hoặc đo thực địa)
- Xác nhận Q20–Q24 (ranh giới tầng, biển "3", lối chuyển PH_008→PH_009)
- Chụp thêm ảnh F3 (Tầng 2)

---

## CP0-PHOTO-SURVEY (2026-11-02)

**Đã làm:** Phân tích 15 ảnh khảo sát thực địa BV Quân y 7A (2 lô, mỗi ảnh 1 lần). Tạo `data/photo-nodes.json` (15 node, schema đầy đủ, 7 kiểm tra DoD PASS) và `docs/photo-survey.md` (bảng phân tích, so sánh T1/T2, privacy, 10 câu hỏi). Thêm Q20–Q24 vào ROADMAP.md mục Câu hỏi mở.

**Phát hiện quan trọng:**
- PH_001–005: F1 Sảnh (chắc chắn). Đặc điểm: sàn marble đen-trắng, trần cao, quầy tiếp tân màu vàng.
- PH_006–008: F1 hành lang (ước lượng) — sàn tile trắng, thanh vịn inox, thang máy "3".
- PH_009–012: F2 = Tầng 1 (ước lượng). PH_012 bằng chứng mạnh: lan can kính nhìn xuống khu chờ bên dưới.
- PH_013–015: F2 hay F3 — **không xác định**. Sàn trắng+dải terrazzo, không thấy biển tầng.
- **F3 (Tầng 2): chưa có ảnh** — tuyến khảo sát chưa hoàn thành.
- **EXIF:** không có DateTimeOriginal trong 15 ảnh; thứ tự dùng tên file.
- **assets/survey-photos/:** chưa tạo, ảnh gốc hiện ở `C:\Users\Dell\AppData\Local\Temp\claude\...\images\`.

**Cần mang về Claude Chat bàn:**
1. Ranh giới F2/F3: PH_013–015 ở Tầng 1 hay Tầng 2? → cần ảnh cầu thang F2→F3 hoặc biển "Tầng 2".
2. Biển "3" tại sảnh thang máy PH_008: số buồng, số tầng hay khu?
3. Lối chuyển PH_008→PH_009: thang máy hay cầu thang? Cần ảnh bổ sung.
4. Chụp thêm ảnh F3 để hoàn thành tuyến Sảnh→T1→T2.
5. Di chuyển ảnh vào `assets/survey-photos/` và thêm vào `.gitignore` (ảnh có mặt người: PH_001–005, PH_012).

**File đã tạo/sửa:**
- `data/photo-nodes.json` — MỚI
- `docs/photo-survey.md` — MỚI
- `ROADMAP.md` — thêm Q20–Q24
- `PROJECT_STATUS.md` — thêm CP0-PHOTO-SURVEY
- `HANDOVER.md` — thêm CP0-PHOTO-SURVEY

---

## CP-BEACON-SETUP (2026-10-30)

**Đã làm:** (1) Xác minh gitignore: `data/beacons.local.json` bị bỏ qua đúng (`.gitignore:43`). (2) `tools/beacon_setup/new_project_uuid.ps1` — sinh UUID, sao từ example, không in, không ghi đè. (3) `tools/beacon_setup/validate_beacons.py` — 8 kiểm tra hợp lệ, exit 1 khi lỗi. (4) `tools/beacon_bridge/bridge.py` — thêm `--beacons` arg tự build allowlist từ beacons.local.json (1 file thay đổi, không đổi giao thức). (5) `tools/beacon_setup/diagnose_beacons.py` — WebSocket + so sánh file, báo KHỚP/LỆCH/THIẾU, UUID che 4 ký tự đầu. (6) `tools/beacon_setup/summarize_calibration.py` — thống kê IQR + hồi quy log-distance, đề xuất rssiAt1m. (7) `tools/beacon_setup/test_beacon_setup.py` — 24/24 tests pass. (8) Liệt kê COM thật: **COM7 = Silicon Labs CP210x (CP2102) — OK, sẵn sàng nối beacon.** COM3-6 = Bluetooth serial. (9) Timeout `LOST_TIMEOUT_MS = 10_000 ms` (10s) tại `src/beacon-admin/main.js:12` — đúng yêu cầu. (10) `docs/DATA_MODEL.md` — thêm "Quy ước Major/Minor (chốt)". (11) `HUONG_DAN.md` — chèn B1/D1/E5/F3 tại đúng bước.

**Kiểm chứng:** 24/24 tests pass; git check-ignore OK; validate phát hiện đúng lỗi "File phải là JSON array"; summarize với CSV tổng hợp (A_true=-62, n_true=2.3) → A=-62.1, n=2.238, R²=0.9977; --beacons arg hiện trong bridge.py --help.

**Vấn đề cần xử lý ngay:**
- `data/beacons.local.json` hiện là **single JSON object, không phải array**. Validate sẽ báo lỗi "File phải là JSON array". Cần sửa thành `[{...}]` hoặc xóa và chạy `new_project_uuid.ps1` lại.

**Lệnh phải tự chạy (theo thứ tự):**

```
# 1. Tạo/sửa beacons.local.json (nếu chưa có hoặc cần tạo lại):
powershell -ExecutionPolicy Bypass -File tools\beacon_setup\new_project_uuid.ps1
#    → Sau đó mở data\beacons.local.json, điền Major/Minor/x/z thật

# 2. Validate trước khi đo:
python tools/beacon_setup/validate_beacons.py

# 3. Chạy cầu nối (tự build allowlist từ file beacon):
cd tools/beacon_bridge && .venv/Scripts/activate
python bridge.py --beacons ../../data/beacons.local.json
#    Terminal khác:
npm run dev  →  mở http://localhost:5173/beacon-admin.html

# 4. Diagnose sau khi bridge đang chạy:
python tools/beacon_setup/diagnose_beacons.py --duration 10
#    Xem COM7 có thấy iBeacon không (cần nRF Connect hoặc Run in RAM trước)

# 5. Summarize sau khi đo 0.5/1/2/4/8 m:
python tools/beacon_setup/summarize_calibration.py bench/measurements/<file>.csv
```

**Cần mang về Claude Chat bàn:**
- `data/beacons.local.json` hiện là object thay vì array — cần quyết định sửa tay hay chạy lại script.
- COM7 CP2102 đã ở trạng thái OK — có nghĩa là cáp đã được cắm. Xác nhận: đây là cáp nối vào beacon chưa, hay chỉ là cáp vẫn cắm từ lần thử trước?
- Sau khi Run in RAM và diagnose: kết quả RSSI có hợp lý không?
- Thời điểm chốt Burn policy (văn bản phê duyệt).

**Câu hỏi mở:**
- UUID trong beacons.local.json hiện tại (`f673e433-...`) được sinh từ đâu? Có phải UUID thật đã dùng không?

---

## CP-BEACON-BRIDGE (2026-10-30)

**Đã làm:** (1) `tools/beacon_bridge/` — `ibeacon.py` (decode thuần, 13 tests pass), `bridge.py` (BleakScanner → throttle 5msg/s/key → WebSocket 127.0.0.1:8765), `requirements.txt` (bleak==0.22.3, websockets==13.1), `.venv` riêng đã tạo nhưng chưa cài được (cần internet). (2) `.gitignore` cập nhật: `data/beacons.local.json`, `tools/beacon_bridge/allowlist.json`. (3) `data/beacons.local.example.json` — template UUID thật. (4) `src/beacon-admin/smoothing.js` — `SlidingWindow`. (5) `src/beacon-admin/sources.js` — `LaptopBridgeSource` (WebSocket, auto-reconnect backoff 1→30s), `MockReplaySource` (5 kịch bản). (6) `beacon-admin.html` + `src/beacon-admin/main.js` — trang kỹ thuật viên: danh sách registered, unknown, modal "Gán vị trí" + mini-map canvas, CalibrationRecord (30 mẫu → xuất JSON). (7) `vite.config.js` thêm entry `beacon-admin`. (8) `tests/beacon_admin.test.mjs` — 20 tests. (9) `package.json` thêm `--test-force-exit` và `tests/beacon_admin.test.mjs`. (10) `README.md` + `HUONG_DAN.md` §2 cập nhật.

**Kiểm chứng:** 103/103 tests pass (npm test); build OK (dist/beacon-admin.html); validate 0 lỗi; Python 13/13 (không cần Bluetooth); bridge.py --help OK; UUID không lộ trong file tracked.

**Việc chủ dự án phải tự làm trước khi test beacon thật:**

1. **Cài gói Python bridge** (cần kết nối internet):
   ```
   cd tools/beacon_bridge
   .venv/Scripts/activate
   pip install -r requirements.txt
   ```
2. **Điền `tools/beacon_bridge/allowlist.json`** (sao chép từ `allowlist.json.example`, điền key thật).
3. **Điền `data/beacons.local.json`** (sao chép từ `data/beacons.local.example.json`, điền UUID/Major/Minor thật từ nRF Connect sau Run-in-RAM).
4. **Chạy bridge + mở trang:**
   - Terminal 1: `cd tools/beacon_bridge && .venv/Scripts/activate && python bridge.py`
   - Terminal 2: `npm run dev` → mở `http://localhost:5173/beacon-admin.html`
5. **Kiểm tra trực quan:** chọn "Bridge", bật beacon → marker chuyển green ≤3s; tắt beacon → red sau 10s.
6. **Ghi CalibrationRecord:** đứng cách beacon 1m, nhấn "Bắt đầu đo", xuất file JSON vào `bench/measurements/`.

**Cần mang về Claude Chat bàn:**
- Kết quả đo RSSI thật với TEL0149 → có hợp lý không? Cần điều chỉnh tham số nào?
- Phase 1: iPhone + iBeacon → app native Core Location ranging theo UUID, xác minh API trên developer.apple.com.
- Thời điểm chốt Burn policy (văn bản phê duyệt từ chủ bệnh viện).
- Khi nào có domain HTTPS để dùng QR code thật cho bệnh nhân.

---

## CP-BLE-REAL (2026-10-30)

**Đã làm:** (1) Gitignore bảo vệ `data/beacon-map.local.json` và `bench/measurements/*.csv`. (2) Template `data/beacon-map.local.json` — chủ dự án tự điền UUID/Major/Minor thật. (3) Module `src/positioning/load_beacon_map.js` tách logic fetch, ưu tiên local → fallback placeholder; có test. (4) `src/main.js _startBLEAdapter()` dùng module mới; toast phân biệt nguồn; hiện banner + toast hướng dẫn khi lost. (5) `bench/index.html` thêm nút "Tải local", hint nguồn, tên CSV có HHMMSS. (6) `docs/HARDWARE.md` mục 9 — bảng 10 mốc đo RSSI ĐỂ TRỐNG. (7) `tools/suggest-thresholds.mjs` — đọc CSV, in đề xuất ngưỡng ra stdout, không tự ghi. (8) 2 test mới cho loadBeaconMap (local/fallback). (9) `HUONG_DAN.md` mục 10–11 — quy trình ?beacon=real và ?at= iPhone.

**Kiểm chứng:** 83/83 tests pass; build OK; gitignore xác nhận; không UUID thật trong file tracked; script chạy với CSV synthetic.

**Việc chủ dự án phải tự làm với beacon thật (theo thứ tự):**

1. **Điền `data/beacon-map.local.json`:** Thay `"ĐIỀN-UUID-THẬT-lower-MAJOR-MINOR"` bằng beaconKey thật (dạng `<uuid-lower>-<major>-<minor>`), đặt `roomId` đúng phòng gần beacon. Xem HUONG_DAN.md mục 10 để biết định dạng.
2. **Đo RSSI (bench test):** Mở `http://localhost:5173/bench/index.html` → "Tải local" → "Bắt đầu quét" → đo từng mốc 0.5/1/2/4/8 m × 2 điều kiện (≥60 giây mỗi mốc) → "Xuất CSV" → lưu vào `bench/measurements/`. Xem HUONG_DAN.md mục 9.
3. **Điền bảng `docs/HARDWARE.md` mục 9** với kết quả đo thực (trung bình, σ, n mẫu).
4. **Chạy script đề xuất ngưỡng:** `node tools/suggest-thresholds.mjs bench/measurements/<file>.csv` → xem xét và cập nhật `DEFAULT_PARAMS` trong `bench/room-resolver.js` nếu đồng ý.
5. **Kiểm thử ?beacon=real:** Chrome/Edge bật flag → `localhost:5173/?beacon=real` → lại gần beacon → xác nhận "near-room" đúng phòng → tắt beacon → xác nhận banner "Mất tín hiệu" hiện trong ≤10 giây. Xem HUONG_DAN.md mục 10.
6. **Kiểm thử ?at= trên iPhone:** iPhone cùng WiFi → `http://<LAN-IP>:5173/?at=F1_R001` → xác nhận toast và marker đúng. Xem HUONG_DAN.md mục 11.

**Câu hỏi mở (mang về Chat khi cần):**
- Sau khi đo RSSI: các tham số đề xuất có hợp lý không? Có cần điều chỉnh `sampleTTL_ms`, `minConsecutive`?
- UUID thật phù hợp để chốt cấu hình Burn (chỉ thực hiện khi có văn bản phê duyệt)?
- Khi nào có domain HTTPS để sinh QR thật (`node tools/gen_qr_links.mjs https://<domain>`)?

---

## CP-BLE-INTEGRATION (2026-10-28)

**Đã làm:** (1) Sửa `bench/index.html` lỗi `startReal is not defined` — xóa 8 dòng gán `window.*` sớm. (2) `?at=<roomId>` trong `src/main.js`: đọc param, áp vị trí sau scene load, toast lỗi khi id sai. (3) Trang `scan/index.html` (URL `/scan/`): quét BLE → tên phòng → nút "Đi đến đây" redirect `/?at=`; fallback màn hình QR cho iPhone. Đăng ký vào `vite.config.js` multi-page build. Script `tools/gen_qr_links.mjs` sinh HTML link `?at=` cho mọi phòng. (4) `src/positioning/ble_adapter.js`: dynamic import bench/ khi `?beacon=real`; callback `onRoom`; type `'ble'` trong `updatePositionStatus`. `data/beacon-map.json` placeholder 12 entry UUID `00000001-…`.
**Kiểm chứng thực tế:** 81/81 tests pass; build OK; dist/scan/index.html có mặt; không UUID thật; không dependency mới.
**Chưa kiểm (cần phần cứng/thiết bị thật):** bench trên Chrome sau sửa lỗi; `?at=` trên iPhone Safari; `/scan` trên Chrome Android; `?beacon=real` với beacon Run in RAM.
**Bước tiếp theo — mang về Chat:** (a) Xác nhận bench đã sửa đúng (mở `/bench/index.html` → bấm "Bắt đầu quét"). (b) Run in RAM → cập nhật `data/beacon-map.json` UUID/Major/Minor thật. (c) Thử `/scan` trên Chrome Android. (d) Chốt URL domain HTTPS để sinh QR thật: `node tools/gen_qr_links.mjs https://<domain>`.

---

## CP-THREE-FLOOR-UI (2026-10-26)

**Kết quả: Hoàn thành theo yêu cầu chủ dự án: thu gọn còn Tầng trệt, Tầng 1, Tầng 2 và làm giao diện/thao tác ổn định hơn.**

- Giữ ID F1/F2/F3 và tọa độ, chỉ đổi tên hiển thị thành Tầng trệt/Tầng 1/Tầng 2. Lọc toàn bộ dữ liệu runtime cùng lúc: phòng, nút, cạnh, connector và beacon. Không xóa dữ liệu nguồn 9 tầng, không thay GLB tạm.
- Thêm src/ui/floorScope.js: phạm vi 3 tầng và điều kiện phân biệt kéo/chạm. Có 126 phòng trong phạm vi, 42 phòng mỗi tầng theo dữ liệu mẫu hiện có. Không coi đây là số phòng đã khảo sát thực tế.
- Giao diện: khung sáng xanh xám, bảng tìm đường bên trái, một bộ chọn tầng trên bản đồ, Một tầng/Cả 3 tầng, tiện ích SVG và tùy chọn hiển thị mở rộng; điện thoại đặt bản đồ phía trên biểu mẫu. Bổ sung đường dẫn mở trang kiểm thử beacon có sẵn; không triển khai BLE thật trong phiên này.
- Loại bỏ intro tự chạy, nhận double-tap toàn cục, tự bay camera khi chọn phòng và reset bằng setTimeout. Kéo/pinch không mở nhầm phòng; raycast cập nhật theo điểm thả và tầng đang xem. Chỉ nút Xem gần/Toàn cảnh, chỉ dẫn hoặc thao tác vị trí do người dùng chọn mới đổi camera; chuyển động có thể ngắt bằng thao tác tay.
- Camera đặt target đúng tâm, fit toàn bộ tầng theo kích thước canvas, giữ góc/độ phóng khi đổi tầng. Không dùng tween chung cho tầng và camera. Giới hạn góc để không lật xuống dưới sàn.
- Tên tầng đồng nhất trong tìm kiếm, chỉ dẫn chữ/giọng nói và bản đồ 2D; sửa trường hợp sửa nội dung input nhưng vẫn giữ roomId đã chọn trước đó. Gợi ý chọn được bằng bàn phím; bổ sung trạng thái không có kết quả.
- File: index.html, src/main.js, src/map2d/Map2D.js, src/nav/instructions.js, src/ui/floorScope.js, src/ui/wayfinding.css, tests/ui.test.mjs, package.json; không thêm dependency.

### Kiểm chứng

- 75/75 tests đạt: 72 có sẵn + 3 test mới kiểm tra phạm vi/đường đi thường và xe lăn giữa tầng, phân biệt kéo/chạm, tên tầng trong chỉ dẫn. Bộ test chạy lại sau tinh chỉnh không lỗi.
- npm run build thành công; JS chính khoảng 756,9 kB (gzip 198,1 kB), CSS khoảng 34,8 kB. Vite còn cảnh báo chunk >500 kB, không vô hiệu hóa cảnh báo.
- Trình duyệt tích hợp: bấm phòng mở sheet; kéo bản đồ không mở sheet; chuyển tầng và Một tầng/Cả 3 tầng; tìm đường từ tầng trệt đến tầng 2; chọn kết quả bằng ArrowDown/Enter; tìm kiếm không kết quả; không có console error trên trang chính ở lần kiểm cuối.
- Kiểm tra bố cục 1440×900, 768×1024, 390×844; không tràn ngang ở các phép đo responsive. Điện thoại thấy nút Tìm đường đi ngay trong vùng hiển thị. Bản đồ ?force2d=1 có đúng ba nút tầng với tên mới.
- TASTESKILL lint: 0 FAIL, 9 WARN. Các WARN là nhãn section-label của nhóm thao tác (không phải eyebrow trang), shadow chỉ cho sheet/toast nổi và backdrop-filter:none bị nhận theo tên thuộc tính. Impeccable detector chạy; cảnh báo kế thừa từ CSS gốc được đối chiếu với computed style/ảnh cuối (position-status không viền/nền, không glow trên biểu mẫu mới).
- Chọn hướng Framed sheet, seed 123711599, giữ nền nhận diện bệnh viện và dùng mô hình 3D làm nội dung chính. Không dùng ảnh/biểu đồ hoặc số liệu bịa.
- Ảnh xác minh giao diện được lưu trong outputs của chat: giao-dien-3-tang-desktop.png và giao-dien-3-tang-mobile.png.

### Giới hạn giữ nguyên

- Sơ đồ, tên phòng và dữ liệu vẫn là bản thử nghiệm; cần đối chiếu hiện trường. Pipeline GLB và tỉ lệ provisional không được thay trong phiên này.
- Beacon thật chưa kết nối viewer; trang bench có mã riêng và lỗi khởi tạo đã báo trước vẫn ngoài phạm vi phiên giao diện này.
- Chưa thử trên điện thoại phần cứng thật hoặc điều khiển Cốc Cốc trực tiếp; các kiểm tra UI dùng trình duyệt tích hợp với kích thước responsive.
- Người dùng tải lại localhost:5173 (Ctrl+F5) để nhận giao diện mới. Chưa commit/push/deploy.


## Đối chiếu thông báo CP-3D-PIPELINE (2026-10-26)

**Kết quả: Hoàn thành phạm vi triển khai pipeline theo thông báo chủ dự án.** Chưa xác nhận tỉ lệ thực, chất lượng trực quan hoặc DoD phase chính thức.

- Đã có build_floor.py v2, GLTFLoader và nhánh ?model=glb, trang tools/webgl_check.html không CDN, tools/README_build.md và checkpoint CP-3D-PIPELINE.
- Đọc trực tiếp JSON xác nhận: 1.457 đoạn tường, 586 cửa, 73 phòng. M_PER_PX = 0.016402066697980274 m/px, vẫn là tỉ lệ TẠM.
- Có 6 ảnh kết quả: F1_iso_dollhouse_NE.png, F1_iso_dollhouse_NW.png, F1_iso_dollhouse_SE.png, F1_iso_full.png, F1_topdown.png, F1_overlay.png; ngoài ra có 2 PNG mask.
- Đọc cấu trúc GLB xác nhận bản mới: F1_dollhouse_provisional_160729.glb (877.116 byte, khoảng 856 KiB) và F1_full_provisional_160733.glb (855.104 byte, khoảng 835 KiB); mỗi bản có 1.601 mesh và 19.212 tam giác. Cũng có một cặp bản mới từ lần chạy trước với hậu tố _160652/_160657.
- **Lưu ý viewer:** file không hậu tố F1_dollhouse_provisional.glb/F1_full_provisional.glb vẫn là bản cũ (82 mesh, 984 tam giác). Nhánh ?model=glb mặc định tải file không hậu tố, chưa tự chọn bản mới.
- Xem đúng bản mới sau khi chạy npm run dev:
  - Dollhouse: http://localhost:5173/?model=glb&glb=/assets/models/F1_dollhouse_provisional_160729.glb
  - Full: http://localhost:5173/?model=glb&glb=/assets/models/F1_full_provisional_160733.glb
- Build 754 KB và pipeline khoảng 50 giây: kết quả do chủ dự án cung cấp và đã có trong checkpoint trước; phiên đối chiếu này không chạy lại build hoặc pipeline.
- Còn lại: chủ dự án xem 6 ảnh render, cung cấp khoảng cách thực cùng số pixel tương ứng cho --ref-px/--ref-m; xác nhận hướng Bắc và ưu tiên vòng sửa 2 theo Q-3D-1..4 trong HANDOVER.md.
- Beacon: trạng thái không đổi, chưa xác nhận gói thật bằng nRF Connect, chưa nối bộ quét BLE thật vào viewer. Tỉ lệ/hệ tọa độ GLB tạm chưa được xác nhận đồng bộ với đồ thị và beacon.

**Phiên trước:** 2026-10-26 – CP-BENCH-TOOL: công cụ bench BLE beacon.
**Phiên này:** 2026-10-26 – CP-3D-PIPELINE: pipeline Python ảnh mặt bằng → GLB 3D + 6 PNG render.

---

## 0. Đã làm phiên này (CP-3D-PIPELINE)

| Việc | Kết quả |
|---|---|
| Viết lại `tools/build_floor.py` v2 | ✓ Pipeline hoàn chỉnh: mask→wall→room flood-fill→3D→render |
| Fix bug minLineLength (`30/M/3` → `0.30/M`) | ✓ Tường: 39 → **1457** đoạn |
| Fix màu render (overflow uint8 khi baseColorFactor) | ✓ Dùng `_COLOR_REGISTRY` dict riêng |
| Fix room detection → flood-fill từ seed | ✓ Phòng: 3 → **73** (14 nhãn) |
| Fix auto-center view | ✓ Dùng projected bounding box thay vì hardcode cy |
| Fix path skeleton (không có ximgproc) | ✓ Dùng contour của blue mask eroded |
| Fix numpy `ptp()` deprecated → `max()-min()` | ✓ |
| Thêm `GLTFLoader` import + nhánh `?model=glb` vào `src/main.js` | ✓ |
| `npm run build` sau patch | ✓ 754KB/197KB gzip — không lỗi |
| Tạo `tools/webgl_check.html` | ✓ Standalone, không CDN, WebGL2/1, GPU info, copy button |
| Tạo `tools/README_build.md` | ✓ Tài liệu chạy pipeline |
| Cập nhật `PROJECT_STATUS.md` | ✓ CP-3D-PIPELINE |

### Kết quả pipeline chạy thực tế

```
Tường:  1457 | Cửa: 586 | Phòng: 73 (14 nhãn) | Paths: 3
GLB dollhouse: F1_dollhouse_provisional.glb — 856 KB, 1601 mesh, 19212 tri
GLB full:      F1_full_provisional.glb — 835 KB, 1601 mesh, 19212 tri
PNG render:    6 file → tools/out/
Thời gian:     ~50s
M_PER_PX:      0.01640 m/px (TẠM – Cần xác nhận đo thực)
```

### Tự đánh giá lỗi thẩm mỹ (≥5)

1. Walls nhiễu do cross-hatch cầu thang và ký hiệu X-shaft bị cắt thành segment ngắn
2. Sàn phòng là bbox hình chữ nhật → chồng lấn phòng liền kề
3. Kích thước/vị trí cầu thang ước lượng từ seed pixel, chưa đo thật
4. Shader chưa có AO (thiếu shadow chân tường/góc phòng)
5. Labels đặt tại centroid bbox → phòng nhỏ bị label ra ngoài bounds
6. Hướng Bắc la bàn chưa xác nhận → hiển thị "N?"
7. Path strips từ contour eroded → hình dạng không đúng centerline

### Câu hỏi mở — Cần mang về Claude Chat bàn

**Q-3D-1 (tỉ lệ):**
Đo 2 điểm trên bản in (hoặc biết chiều dài hành lang thực từ bản vẽ kỹ thuật).
Cung cấp `--ref-px <px>` và `--ref-m <m>` để tính lại M_PER_PX chính xác.

**Q-3D-2 (hướng Bắc):**
Sơ đồ hướng lên là hướng gì (Bắc / Nam / Đông / Tây)?
Ảnh hưởng đến góc xoay la bàn trong render.

**Q-3D-3 (vòng sửa 2):**
Sau khi xem 6 ảnh render và overlay, ưu tiên sửa tiếp điều gì?
- Sàn polygon chính xác (shapely) thay vì bbox?
- Tăng chất lượng AO/lighting?
- Labels và font?
- Cầu thang kích thước đúng?

**Q-3D-4 (dùng GLB trong viewer):**
Muốn thử xem GLB provisional trong viewer 3D ngay (`npm run dev` rồi `?model=glb`) không?
Nếu có, cần chạy `npm run dev` và mở `http://localhost:5173/?model=glb`.

---

---

## 0. Đã làm phiên này (CP-BENCH-TOOL)

| Việc | Kết quả |
|---|---|
| `npm test` 45/45 trước phiên | ✓ Đã xác nhận |
| Tạo `bench/packet-parser.js` | ✓ iBeacon, Eddystone, unknown; buildIBeaconManufacturerData; iBeaconKey |
| Tạo `bench/room-resolver.js` | ✓ RoomResolver: sliding avg, IQR outlier, TTL, hysteresis, minConsecutive, fallback mất tín hiệu, stats() |
| Tạo `bench/beacon-source.js` | ✓ detectBluetooth() feature detection; RealSource (requestLEScan → watchAdvertisements → error); SimulatedSource (5 kịch bản, seeded RNG) |
| Tạo `bench/beacon-map-sample.json` | ✓ 5 entry placeholder, không UUID thật |
| Tạo `bench/index.html` | ✓ Kiểm tra trình duyệt, quét BLE/giả lập, bảng gói, resolver, CSV export, tiếng Việt |
| Tạo `bench/README.md` | ✓ Cách chạy, bật cờ Chrome/Cốc Cốc, giới hạn, tham số resolver |
| Tạo `tests/bench.test.mjs` | ✓ 27 tests: packet-parser (16), room-resolver (11) — dữ liệu tổng hợp ghi rõ "synthetic" |
| Cập nhật `package.json` | ✓ Thêm bench.test.mjs vào test script |
| `npm test` sau phiên | ✓ **72/72** pass (thêm 27 test) |
| Cập nhật `HUONG_DAN.md` mục 9 | ✓ Trỏ tới bench/ |
| Cập nhật `PROJECT_STATUS.md` | ✓ CP-BENCH-TOOL + bảng kiểm chứng |
| Việc 6 (nối vào app) | DỪNG — ghi Câu hỏi mở (xem bên dưới) |

### Giả định và "Cần xác nhận"

| # | Mục | Trạng thái |
|---|---|---|
| 1 | Bo beacon có thực sự phát gói iBeacon không? | Cần xác nhận (iPhone quét thấy gói Windows, chưa thấy iBeacon) |
| 2 | UUID/Major/Minor thật của bo sau Run in RAM | Cần xác nhận sau khi thử Run in RAM |
| 3 | Cốc Cốc hỗ trợ Web Bluetooth (phiên bản nào, cờ nào) | Cần xác nhận |
| 4 | Các tham số RoomResolver (ngưỡng, biên, TTL) | Cần xác nhận bằng đo thực; không cam kết sai số |
| 5 | Trang bench chạy được trực quan trên trình duyệt | Cần chủ dự án mở http://localhost:5173/bench/index.html |

### Câu hỏi mở — Cần mang về Claude Chat bàn

**Q-BENCH-1 (nối vào app — Việc 6):**
Điểm nối rõ ràng TỒN TẠI trong main.js (`simPosition`, `updatePositionStatus`).
Nhưng cần quyết định TRƯỚC khi thêm adapter:
- **Kiến trúc:** Có để Vite import động từ `bench/room-resolver.js` và `bench/beacon-source.js` không? Nếu có: adapter ~50 dòng, không đổi test; bench/ vẫn standalone vì import dynamic chỉ chạy khi có `?beacon=`.
- **beaconKey format:** `data/beacons.json` hiện có uuid = "SIMULATED". Cần chốt format beaconKey thật (dạng `<uuid-lower>-<major>-<minor>`) và cập nhật `data/beacons.json` khi có Run in RAM xong.
- **Phụ thuộc:** Nếu không muốn import từ bench/, tạo `src/positioning/ble_adapter.js` riêng (trùng lặp logic).

**Q-BENCH-2 (kết quả RSSI thực tế):**
Sau khi Run in RAM thành công: đo RSSI tại 1 m, 2 m, 4 m, điền vào `docs/HARDWARE.md`.
Dùng số liệu thực để hiệu chỉnh tham số RoomResolver (rssiThreshold, hysteresisMargin).

**Q-BENCH-3 (quyết định có chạy bench thật không):**
Kế hoạch thử nguồn thật: Run in RAM xong → mở bench trên Chrome/Cốc Cốc/Edge → bật cờ → quét.
Nếu laptop không thấy iBeacon (thấy Windows packet): lọc theo UUID trong ô lọc của bench.

---

## Từ phiên trước (CP-HARDWARE-DOCS)

## 0. Đã làm phiên này (CP-HARDWARE-DOCS)

| Việc | Kết quả |
|---|---|
| Tải 3 PDF từ DFRobot vào `assets/hardware/` | ✓ datasheet 1.85 MB, schematics 55 KB, dimension 56 KB — tất cả `%PDF` |
| Cập nhật `assets/hardware/TEL0149_nguon_tai_lieu.md` | ✓ Đổi trạng thái "Chưa tải" → "Đã tải" |
| Tạo `docs/HARDWARE.md` | ✓ Bảng kiểm kê, thông số, chân P1, Run in RAM/Burn, Mâu thuẫn, Chưa xác minh, Tài liệu |
| Thêm mục 9 (mô hình một beacon/phòng) và mục 10 (thiết bị thử nghiệm) vào `docs/ARCHITECTURE.md` | ✓ |
| Thêm bước 4a–4f, rủi ro, DoD bổ sung, Câu hỏi mở Q12–19 vào `ROADMAP.md` Phase 0 | ✓ |
| Thêm trường `configMode`, `roomId`, `sku`, `mac`... vào Beacon; `beaconId` vào Room; ràng buộc validate dự kiến | ✓ vào `docs/DATA_MODEL.md` |
| Thêm mục 7 (bench test RSSI) và mục 8 (Run in RAM) + khung cảnh báo Burn vào `HUONG_DAN.md` | ✓ |
| Cập nhật `README.md`: mô hình proximity/zone, sơ đồ kiến trúc, bảng thư mục | ✓ |
| Thêm CP-HARDWARE-DOCS + bảng kiểm chứng + bước tiếp theo vào `PROJECT_STATUS.md` | ✓ |
| Thêm quy tắc 10 cấm Burn vào `CLAUDE.md` mục 3 | ✓ |

### Giả định và "Cần xác nhận" quan trọng

| # | Mục | Trạng thái |
|---|---|---|
| 1 | SKU thực tế của bo: TEL0149 hay khác? | Cần chủ dự án đối chiếu bo/hộp |
| 2 | Điện áp cấp vào bo: wiki 1.2–5.5 V / Core 3.3–5.5 V / chip 1.1–3.6 V | Mâu thuẫn — ghi cả 3, chưa kết luận |
| 3 | Phiên bản datasheet: tên file V1.0 / nội dung V1.3 | Cần xác nhận |
| 4 | Chiều TX↔RX cổng P1 và điện áp cáp CP2102 | Phải nhìn hình wiki trước khi nối |
| 5 | Cách cấp nguồn/pin khi gắn tường | Chưa biết |
| 6 | Báo mức pin qua BLE advertisement | Chưa tìm thấy bằng chứng |
| 7 | Hành vi bo chưa Burn khi cấp điện | Chưa biết |
| 8 | Quy trình ngắt nguồn trước Run in RAM thứ 2 (từ TEL0168) | Cần xác nhận cho TEL0149 |
| 9 | Ý nghĩa chính xác "RUN IN RAM" từ bên phát thiết bị | Cần hỏi bên phát |

### Cần mang về Claude Chat bàn (phiên này)

1. **Chốt SKU:** Đối chiếu mã bo/hộp với "TEL0149". Nếu khác, tất cả thông số trong HARDWARE.md cần đối chiếu lại.
2. **Chính sách Burn (ROADMAP bước 4f):** Sau khi thử Run in RAM + bench test, bàn và chốt bằng văn bản: số bo cần, bo dự phòng, quy ước UUID/Major/Minor/chu kỳ phát/công suất. Không Burn trước khi có văn bản này.
3. **Mô hình mốc:** Chỉ beacon tại phòng, hay thêm beacon tại ngã rẽ/sảnh/thang máy? Ảnh hưởng số lượng bo cần.
4. **Số lượng beacon:** Bao nhiêu phòng cần dẫn đường? Ngân sách đủ không?
5. **Cách cấp nguồn:** Pin loại gì, ai thay, chu kỳ bao lâu? Hay dùng nguồn lưới?
6. **Ý nghĩa "RUN IN RAM":** Bên phát thiết bị yêu cầu gì cụ thể khi nói "RUN IN RAM"?

---

**Phiên trước:** 2026-10-26 – WebGL root-cause + bản đồ 2D SVG.
**Phiên trước đó:** 2026-10-26 – Fix hiển thị bản đồ 3D: xóa hasWebGL gate, sample model fallback.

---

## 0. Đã làm phiên này (Fix 3D display)

### Nguyên nhân gốc đã sửa

| # | Nguyên nhân | File:dòng | Sửa |
|---|---|---|---|
| RC1 | `hasWebGL()` là blocking gate — false negative → 3D không bao giờ thử | `src/main.js:79` (cũ) | Xóa nhánh `!hasWebGL()` khỏi if-throw; chỉ còn cảnh báo console |
| RC2 | `camera.aspect = NaN` khi `canvas-wrap` ẩn (w=0, h=0) | `src/main.js`, `onResize()` | Guard: return sớm nếu w=0 hoặc h=0 |
| RC3 | Không có 3D fallback khi data load thất bại | `src/main.js`, `loadAll()` catch | Tạo `sampleModel.js`; dùng khi fetch fail; badge "Dữ liệu mẫu" |

### Thay đổi đã thực hiện

| File | Thay đổi chính |
|---|---|
| `src/main.js` | RC1: bỏ `!QualityManager.hasWebGL()` khỏi blocking if-throw; RC2: guard `if (w===0 \|\| h===0) return` trong `onResize()`; tách `_buildScene()` helper; `loadAll()` 2 bước (fetch → build) với sample fallback |
| `src/scene/sampleModel.js` | **MỚI** — `SAMPLE_DATA` hardcoded: 2 tầng, 11 phòng (entrance/clinic/lab/wc/pharmacy/cashier/elevator/hành lang), 13 nodes, 12 edges. Dynamic import chỉ khi fetch fail |
| `index.html` | Thêm `#sample-data-badge` (hidden mặc định) |
| `src/styles.css` | Style `#sample-data-badge` (tím nhạt, vị trí bottom+40px) |

### Kiểm chứng (đã thực hiện)

| Lệnh / Kiểm tra | Kết quả |
|---|---|
| `npm test` | ✓ **45/45** pass — không test nào hỏng |
| `npm run build` | ✓ JS 666KB/173KB; `sampleModel` chunk mới 4.63KB (dynamic); `Map2D` 4.23KB |
| `http://localhost:5173/` | ✓ HTTP 200 |
| `/data/floors.json`, `/data/rooms.json` | ✓ HTTP 200 — data files phục vụ đúng qua Vite dev server |
| HTML kiểm tra: `#three-canvas` có mặt | ✓ |
| HTML kiểm tra: `#webgl-fallback` có `hidden` | ✓ — chỉ hiện khi renderer thật sự throw |
| RC1 fix xác nhận (curl main.js) | ✓ `hasWebGL()=false — vẫn thử Three.js renderer` trong code |
| Bản đồ 3D trực quan | **Chưa xác minh** — cần chủ dự án mở trình duyệt |

### Hành vi mong đợi sau fix

**Trường hợp bình thường (WebGL hoạt động):**
1. Page load → `hasWebGL()` chỉ log cảnh báo, KHÔNG throw
2. `new THREE.WebGLRenderer()` khởi tạo thành công
3. `loadAll()` fetch `/data/*.json` → 200 OK → `_buildScene()` dựng 9 tầng
4. User click "Bắt đầu" → `showMain()` → `onResize()` (w>0) → `quality.requestRender()` → render frame
5. Bản đồ 3D hiển thị với ánh sáng, màu phòng theo loại

**Trường hợp WebGL không hỗ trợ thật sự (HW accel tắt):**
- `new THREE.WebGLRenderer()` throw → catch → `showWebGLFallback('renderer-failed', err)` → hiện lỗi thật + 2D map SVG
- Thông báo lỗi CỤ THỂ (không còn chung chung)

**Trường hợp data files không tải được:**
- `loadAll()` fetch fail → import `sampleModel.js` → `_buildScene()` dựng 2 tầng mẫu
- Badge "🧪 Dữ liệu mẫu" hiện ở dưới canvas

### Cần chủ dự án xác nhận

1. **[QUAN TRỌNG]** Mở `http://localhost:5173` trong Cốc Cốc (hoặc Chrome):
   - Click "Bắt đầu"
   - Bản đồ 3D có hiện không? (9 tầng, phòng màu pastel, grid floor)
   - Console F12: có lỗi đỏ không?
   - Xoay/zoom bằng chuột có hoạt động không?
2. **Debug check**: Thêm `?debug=1` → có thấy FPS/draw calls không?
3. **Force 2D**: Mở `?force2d=1` → bản đồ 2D SVG có hiện không?
4. **Sample model**: Tạm thời đổi `loadJSON('/data/floors.json')` thành URL sai → sample model có hiện không, badge có xuất hiện không?

---

**Phiên trước:** 2026-10-26 – WebGL fallback + tìm phòng.
**Phiên trước đó:** 2026-10-26 – WebGL root-cause investigation + bản đồ 2D SVG.

---

## 0. Đã làm phiên này (WebGL root-cause + 2D map)

### Nguyên nhân gốc xác định (bằng chứng từ code review)

**Nguyên nhân chính (Loại: code)**: `QualityManager.hasWebGL()` dùng **cùng một `canvas` element** cho cả 3 lần gọi `getContext()`:
```js
// CŨ — có thể sai trên Chromium/Cốc Cốc
const c = document.createElement('canvas');
const ctx = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
```
Trên một số Chromium builds, sau khi `getContext('webgl2')` trả `null` (webgl2 không được), canvas bị đánh dấu ở trạng thái khiến các lần gọi tiếp theo trên **cùng canvas đó** cũng trả `null` — kể cả `webgl` đang hoạt động bình thường.

**Fix**: Tạo canvas mới riêng cho mỗi lần thử:
```js
// MỚI — canvas riêng, không bị khóa
for (const type of ['webgl2', 'webgl', 'experimental-webgl']) {
  const c = document.createElement('canvas');
  const ctx = c.getContext(type);
  if (ctx) return true;
}
```

Test `canvas mới cho mỗi type` trong `tests/map2d.test.mjs` xác nhận behavior này.

**Nguyên nhân phụ**: Màn hình lỗi không hiện lỗi thật — đã sửa bằng `showWebGLFallback(reason, error)`.

**Chưa loại trừ**: Hypotheses (c) `file://` và (d) `canvas 0x0` — không thể kiểm tra không có môi trường Cốc Cốc thật. Cần chủ dự án xác nhận bằng cách mở qua `http://localhost` và xem Console F12.

### Thay đổi đã thực hiện

| File | Thay đổi chính |
|---|---|
| `src/quality/QualityManager.js` | `hasWebGL()`: canvas riêng mỗi lần, log cụ thể từng type |
| `src/main.js` | `showWebGLFallback(reason, error)`: hiện lỗi thật + copy button; `_load2DMode(isForce)` thay `_loadFallbackSearch`; `?force2d=1` |
| `src/map2d/Map2D.js` | **MỚI** — SVG map: rooms màu theo type, nhãn, route polyline, floor tabs, highlight, accessible |
| `index.html` | `#webgl-fallback` mở rộng: `#fb-error-area`, `#fb-error-msg`, `#fb-copy-error`, `#map2d-area`, `#fb-2d-nav` |
| `src/styles.css` | CSS cho `map2d-*`, error copy, 2D nav, webgl-fallback expand |
| `tests/map2d.test.mjs` | **MỚI** — 10 tests: `metersToSVG` (5) + `hasWebGL` mock (5) |
| `package.json` | Test script thêm `map2d.test.mjs` |
| `README.md` | localhost requirement, URL params table, F12 debug guide |

### Kiểm chứng

| Lệnh | Kết quả |
|---|---|
| `npm test` | ✓ **45/45** pass (tăng 10 tests) |
| `npm run build` | ✓ JS 666KB/173KB; Map2D chunk 4.23KB (dynamic import) |
| Cốc Cốc thật | **Chưa kiểm** |

### Cần mang về Claude Chat bàn

1. **Xác nhận root cause trên Cốc Cốc**: Chủ dự án chạy `npm run dev`, mở `http://localhost:5173`, bấm F12 → Console → báo lại log `[WebGL]` có xuất hiện không. Nếu không → 3D đã lên. Nếu có → sao chép log và báo về Chat.
2. **Kiểm tra `?force2d=1`**: Mở `http://localhost:5173?force2d=1` → bản đồ 2D SVG có hiện không, tìm phòng + tìm đường có hoạt động không.
3. **Nếu vẫn báo sai "WebGL"**: Dùng Console DevTools để giả lập: `Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{value:()=>null})` rồi reload → xem màn hình lỗi có hiện lỗi thật không, có nút sao chép không.
4. **Hypothesis còn lại**: Xác nhận mở qua `http://` không phải `file://` (xem address bar).

---

**Phiên trước:** 2026-10-26 – Visual 3D: nâng cấp lớp trình bày (tier, diện mạo, hiệu ứng, UI).
**Phiên trước đó:** 2026-10-26 – WebGL fallback + tìm phòng: sửa lỗi viewer báo "không hỗ trợ WebGL" trên Cốc Cốc; fallback search hoạt động không cần 3D.

---

## 0. Đã làm phiên này (WebGL fallback + tìm phòng)

### Vấn đề gốc
Triệu chứng trên Cốc Cốc: "Trình duyệt không hỗ trợ WebGL / Tìm kiếm phòng:" — ô tìm kiếm không hoạt động.

**Nguyên nhân 1**: `QualityManager.hasWebGL()` không thử `experimental-webgl` — có thể gây false negative trên Chromium cũ.

**Nguyên nhân 2** (chính): Khi `hasWebGL()` trả về `false`, code gọi `showWebGLFallback()` rồi `throw new Error(...)` dừng module. `loadAll()` không bao giờ chạy → `searcher` null → ô tìm kiếm fallback hoàn toàn vô dụng.

### Fixes đã thực hiện

| File | Thay đổi |
|---|---|
| `src/quality/QualityManager.js` | `hasWebGL()`: thêm `experimental-webgl`, `console.warn` với `navigator.userAgent` khi không có context |
| `src/main.js` | `showWebGLFallback(reason)`: hỗ trợ reason `'renderer-failed'`; gọi `_loadFallbackSearch()` TRƯỚC throw; try-catch quanh `new THREE.WebGLRenderer()` (lỗi renderer ≠ lỗi WebGL); thêm `_loadFallbackSearch()` async function (hoisted) |
| `index.html` | Fallback div: IDs `fb-title`/`fb-desc`, danh sách tips hướng dẫn Cốc Cốc + `coccoc://gpu`, `fb-search` focus, `fb-results hidden` |
| `src/styles.css` | `.fb-tips`, `.fb-search-label`, cập nhật `.fb-results` |

### Cơ chế _loadFallbackSearch (kỹ thuật quan trọng)
- Là `async function` declaration → **hoisted** → có thể gọi trước vị trí khai báo trong file.
- Được gọi TRƯỚC `throw new Error('no-webgl')`.
- `throw` dừng module sync, nhưng Promise callbacks đã được queue → microtask queue tiếp tục chạy sau khi module fail.
- Tải `/data/rooms.json`, tạo `RoomSearch` riêng (độc lập với module-level `searcher`), gắn event listener cho `#fb-search`.

### Kiểm chứng
| Lệnh | Kết quả |
|---|---|
| `npm test` | ✓ 35/35 pass |
| `npm run build` | ✓ JS 663KB/172KB, CSS 19KB/4KB |
| Dev server + trình duyệt | **Chưa xác minh trực quan** |
| Cốc Cốc thật | **Chưa kiểm** — không có môi trường |

### Chưa kiểm (cần chủ dự án tự kiểm)
1. **Cốc Cốc bật hardware acceleration**: xem WebGL có hiển thị 3D không.
2. **Cốc Cốc tắt hardware acceleration**: fallback có hiện đúng không, ô tìm kiếm có hoạt động không.
3. **Chrome DevTools → giả lập tắt WebGL**: dùng `Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{value:()=>null})` trong Console → reload → xem fallback + tìm phòng.
4. **Console log**: kiểm tra `[WebGL] Không tạo được context. UA:` xuất hiện khi không có WebGL.

### Cần mang về Claude Chat bàn
- **Cốc Cốc GPU blacklist**: nếu Cốc Cốc dùng GPU cũ/blacklist, `experimental-webgl` cũng fail → cần xác nhận user có thể bật hardware accel không.
- **Fallback 2D**: hiện fallback chỉ có text search. Nếu cần 2D map, cần Canvas 2D từ data/ — xem xét ở Phase 4 khi có dữ liệu phòng thật.

---

---

## 1. Đã làm phiên này (Visual 3D)

### Kết quả kiểm chứng thực tế

| Lệnh | Kết quả |
|---|---|
| `node tools/validate_data.mjs` | ✓ 0 lỗi, 1 cảnh báo (27 nút ngoại vi — đã biết) |
| `npm test` | ✓ **35/35** tests pass (13 suites) – tăng từ 18 |
| `npm run build` | ✓ JS 662KB/172KB gzip, CSS 18.76KB/4.04KB, 5.39s |
| `npm run dev` viewer | **Chưa xác minh trực quan** – không có công cụ trình duyệt |

### Files mới

| File | Mô tả |
|---|---|
| `docs/VISUAL_DESIGN.md` | Bảng màu, tier config, số đo trước/sau |
| `src/quality/QualityManager.js` | Tier low/medium/high, auto-downgrade FPS, render-on-demand, WebGL check |
| `src/utils/tween.js` | Tween module (easing, cancel, TweenManager) |
| `src/scene/RouteRenderer.js` | Route draw-on, shader UV, đa tầng opacity, pin đích |
| `src/scene/PositionMarker.js` | Pulse ring, hướng cone, low-confidence |

### Files đã sửa

| File | Thay đổi chính |
|---|---|
| `src/scene/SceneBuilder.js` | ROOM_COLORS (13 type), EdgesGeometry, tường sứ, dispose(), splitRouteByFloor(), labelPriority() |
| `src/main.js` | Tích hợp tất cả module mới; intro/fly-to/explode tween; render-on-demand; WebGL fallback; debug overlay; floor-strip; saving mode |
| `src/styles.css` | Nền sáng y tế (--clr-bg #EEF4FA), glassmorphism, floor-strip, WebGL fallback CSS |
| `index.html` | floor-strip, btn-saving-mode (🔋), btn-reset-view (🔄), webgl-fallback placeholder |
| `tests/nav.test.mjs` | +17 tests: tween easing/interpolate/cancel, TweenManager, splitRouteByFloor, labelPriority |

---

## 2. Tóm tắt tính năng mới

### A1 – Quality tier system
- Ba tier: **low / medium / high**
- Phát hiện từ: DPR, hardwareConcurrency, deviceMemory, WebGL2
- Auto-downgrade: đo FPS 2.5s đầu, hạ tier nếu dưới ngưỡng
- Nút **🔋 Tiết kiệm** (lưu localStorage, tier → low)
- Render-on-demand: chỉ render khi controls/animation/hover thay đổi
- Tạm dừng khi tab ẩn (visibility change)
- **Fallback WebGL**: nếu không có WebGL → danh sách tìm kiếm phòng (text-only)

### A2 – Diện mạo mới
- Nền sáng y tế (#EEF4FA thay vì #1a1a2e tối cũ)
- Màu sàn phòng theo loại (13 màu pastel, xem VISUAL_DESIGN.md)
- Tường trắng sứ (#FAFCFF, roughness 0.85)
- EdgesGeometry viền cạnh mảnh (tắt ở low)
- HemisphereLight (sky #B3D9F7, ground #C8DFC8) + DirectionalLight
- FogExp2 nhẹ (tắt ở low)
- ACESFilmicToneMapping + sRGBColorSpace
- Post-processing lazy-load: FXAA (medium+), OutlinePass (high)

### A3 – Debug overlay
- Kích hoạt bằng `?debug=1` trong URL
- Hiển thị: FPS, draw calls, triangles, tier, DPR, thời gian tải
- Không gửi đi đâu, không bật mặc định

### B1 – Tween module
- `src/utils/tween.js`: Tween class + TweenManager
- Easing: linear, easeIn, easeOut, easeInOut, easeOutBack, easeOutBounce
- Cancel được, có unit tests đầy đủ

### B2 – Intro animation
- Camera fly từ y=80 xuống y=40 trong ≤ 1.8s
- Bỏ qua bằng tap/click/phím bất kỳ
- Tắt khi prefers-reduced-motion

### B3 – Explode view tween
- Chuyển mode → explode: tween position.y các tầng mượt 600ms
- Chuyển → single/all: ngay (không cần tween cho chuyển về)

### B4 – Fly-to phòng
- Click phòng: camera fly đến phòng (1000ms easeInOut)
- Double-click: fly-to nhanh hơn
- Chọn bước chỉ dẫn: fly-to node (600ms)
- Nút 🔄 Reset góc nhìn

### C1 – Route effects
- Draw-on animation: opacity 0→1 trong 800ms
- Shader chạy dọc tuyến (UV animation) ở tier medium+
- Tuyến nhiều tầng: tầng active opacity 0.9, tầng khác 0.2
- Pin đích drop-in với easeOutBounce

### C2 – Position marker
- Pulse ring TorusGeometry, chu kỳ 2000ms (≥ 1.5s)
- Low-confidence: màu cam, opacity thấp hơn
- Hướng cone (hiện khi có heading)

### C3+C4 – UI
- Bottom sheet: glassmorphism (backdrop-filter blur)
- Floor strip dọc bên phải (#floor-strip)
- Nút 🔋 Tiết kiệm trong header
- Nút 🔄 Reset góc nhìn
- Tương phản ≥ 4.5:1 (nền sáng, chữ #1A2744)
- Vùng chạm ≥ 40px hầu hết, ≥ 48px critical buttons

---

## 3. Giả định "Cần xác nhận"

| # | Mục | Vị trí |
|---|---|---|
| 1 | Ngưỡng tier (DPR, cores, memory) | `QualityManager.js` THRESH |
| 2 | Ngưỡng FPS auto-downgrade (45fps, 30fps) | `QualityManager.js` THRESH |
| 3 | Thời gian đo FPS (2500ms) | `QualityManager.js` THRESH |
| 4 | Khoảng cách ẩn label thường (30m), quan trọng (60m) | `SceneBuilder.js` updateLabels |
| 5 | Thời gian draw-on route (800ms) | `RouteRenderer.js` |
| 6 | Chu kỳ pulse (2000ms) | `PositionMarker.js` |
| 7 | Thời gian intro (1800ms) | `main.js` INTRO_DURATION |
| 8 | Shadow map size (512/1024) | `main.js` cfg.shadowMapSize |
| 9 | Fog density (0.006) | `main.js` |
| 10 | EdgesGeometry có làm nặng không? (378 phòng × 2) | Cần đo draw calls |
| 11 | OutlinePass ở high có gây FPS drop không? | Cần đo |
| 12 | Tất cả ngưỡng từ VISUAL_DESIGN.md | docs/VISUAL_DESIGN.md |

---

## 4. Dependency

| Gói | Phiên bản | Môi trường |
|---|---|---|
| three | 0.186.1 | node_modules (JS runtime) |
| vite | 5.4.21 | node_modules (JS devDep) |
| opencv-python-headless | 5.0.0.93 | tools/.venv (Python pipeline) |
| numpy | 2.5.4 | tools/.venv |
| trimesh | 5.1.1 | tools/.venv |

**Không thêm dependency mới trong phiên này.**

---

## 5. Cách chạy

```bash
npm install
node tools/generate_data.mjs   # sinh data/
npm run dev                    # → http://localhost:5173
npm test                       # 35 tests
npm run validate               # kiểm tra data
npm run build                  # production bundle
```

**URL params:**
- `?dev=1` — bật dev tools (xuất GLB, nút mô phỏng mất tín hiệu)
- `?debug=1` — bật debug overlay (FPS, draw calls, tier, DPR)
- `?kiosk=1` — chế độ kiosk (chữ to hơn, vùng chạm lớn hơn)

---

## 6. Chưa kiểm thử trực quan (cần chủ dự án tự kiểm)

### Visual / UX
1. Diện mạo nền sáng y tế trông như thế nào so với bản cũ (nền tối)
2. Màu phòng theo loại: rõ ràng, không quá nhạt hay quá chói
3. Viền cạnh EdgesGeometry: tinh tế hay nhiễu
4. Intro animation bỏ qua bằng tap
5. Camera fly-to khi click phòng (≤ 1.2s)
6. Exploded view tween mượt 600ms
7. Route draw-on: nhìn thấy vẽ dần
8. Shader chạy dọc tuyến (tier medium+)
9. Pulse marker vị trí (mỗi 2s)
10. Pin đích thả nảy

### Tier & Hiệu năng
11. Debug overlay (`?debug=1`): FPS, draw calls hiện đúng
12. Tier detection: điền thiết bị dùng và tier phát hiện được
13. Auto-downgrade: thử CPU throttle trong DevTools → tier tự hạ
14. Saving mode (🔋): tier → low, DPR = 1
15. FPS ổn định với 9 tầng × 378 phòng × EdgesGeometry

### Tính năng cũ giữ nguyên
16. Tìm kiếm phòng vẫn hoạt động
17. Tìm đường (A*) vẫn hoạt động
18. Chọn vị trí thủ công
19. Chế độ xe lăn
20. Đọc to chỉ dẫn (TTS)

### Checklist nghiệm thu thủ công

| Hạng mục | Thiết bị | Kết quả | Ghi chú |
|---|---|---|---|
| Nền sáng y tế | | Chưa kiểm | |
| Màu phòng theo loại | | Chưa kiểm | |
| Intro animation | | Chưa kiểm | |
| Fly-to camera | | Chưa kiểm | |
| Route draw-on | | Chưa kiểm | |
| Pulse marker | | Chưa kiểm | |
| Floor strip dọc | | Chưa kiểm | |
| Saving mode 🔋 | | Chưa kiểm | |
| Debug overlay ?debug=1 | | Chưa kiểm | |
| Mobile 375px | | Chưa kiểm | |
| Kiosk ~1200px | | Chưa kiểm | |
| Tier detection | | Chưa kiểm | Ghi thiết bị + tier |
| FPS ổn định | | Chưa kiểm | Ghi FPS đo được |
| Draw calls | | Chưa kiểm | Ghi qua ?debug=1 |
| WebGL fallback | | Chưa kiểm | Thử trình duyệt cũ |

---

## 7. Câu hỏi mở (từ phiên này)

1. **EdgesGeometry × 378 phòng** – mỗi phòng tạo thêm 1 LineSegments. Với 9 tầng có thể tăng draw calls đáng kể. Nếu FPS < ngưỡng → cần mergeGeometries edges hoặc tắt. **Cần đo thực tế.**
2. **OutlinePass tier high** – postprocessing thêm render pass. Nếu FPS drop → có thể hạ xuống medium. **Cần đo.**
3. **Shader route** – ShaderMaterial mỗi segment, có thể không hiệu quả khi route nhiều đoạn. **Cần đo.**
4. **Render-on-demand + pulse animation**: Pulse yêu cầu requestRender mỗi frame. Xem xét có nên dùng CSS animation thay không.
5. **Intro animation + splash**: Hiện intro chạy sau `playIntro()` sau khi data load. Nếu user bấm "Bắt đầu" trước khi intro xong → cần kiểm tra behavior.
6. **"Đã tới nơi"** – vẫn chưa có trigger tự động (cần Phase 5 BLE).
7. **Cảnh báo đổi tầng** – logic dựa vào icon 🛗/🚶. Cần test với route đa tầng thực.
8. **Bảng màu chủ đạo** – chuyển từ tối (primary #e94560 đỏ) sang sáng (primary #1565C0 xanh). Cần xác nhận thẩm mỹ.

---

## 8. Cần mang về Claude Chat bàn

1. **Xác nhận giao diện mới:** User chạy `npm run dev` → kiểm tra diện mạo, hiệu ứng (danh sách mục 6 trên).
2. **Số đo hiệu năng thực tế:** FPS, draw calls, thời gian tải qua `?debug=1` → điền vào `docs/VISUAL_DESIGN.md`.
3. **Hiệu ứng nặng:** EdgesGeometry, OutlinePass, shader route — cần quyết định giữ/bỏ/điều chỉnh ngưỡng tier dựa vào số đo.
4. **Tier thresholds:** Sau khi đo trên thiết bị thật, điều chỉnh hằng số trong `QualityManager.js` THRESH.
5. **Phase 0:** Bắt đầu khảo sát thực địa, sơ đồ mặt bằng.
6. **14 mục Cần xác nhận cũ** (từ HANDOVER phiên P0.5).
7. **27 nút orphan:** Quyết định nối vào đồ thị hay bỏ.
8. **Màu chủ đạo:** Chuyển từ đỏ sang xanh dương — cần duyệt thẩm mỹ.

## CP-FALLBACK-HIDDEN-FIX (2026-10-26)

- Triệu chứng: sau khi bấm Bắt đầu, màn hình "Bản đồ 3D không hiển thị được" che bản đồ dù không có lỗi renderer.
- Xác minh trực tiếp trên trình duyệt tích hợp tại localhost:5173: trước sửa, #webgl-fallback có hidden=true nhưng computed display=flex. Bản đồ và giao diện phía sau đã khởi tạo.
- Sửa src/styles.css: thêm #webgl-fallback[hidden] vào quy tắc display:none !important hiện có. Không thay đổi điều kiện phát hiện lỗi WebGL.
- Kiểm chứng: sau sửa computed display=none; ảnh chụp xác nhận mô hình 3D hiển thị. Tải lại trang rồi bấm Bắt đầu vẫn hiện bản đồ. Mở ?force2d=1 vẫn hiện bản đồ SVG 2D và điều khiển tìm đường.
- Kiểm tra bằng trình duyệt tích hợp, chưa điều khiển trực tiếp Cốc Cốc. Người dùng tải lại localhost:5173 trên Cốc Cốc để nhận CSS mới.
- Không chạy lại build/pipeline trong phiên sửa CSS này. Không sửa GLB hoặc tích hợp beacon.
