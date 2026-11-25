# PROJECT_STATUS

## CP-BEACON-PLACE-3D (2026-11-09) — Chế độ "Gán beacon" trên bản đồ 3D (chỉ dev)

**Kết quả: Hoàn thành phần mã/test/route (verifier ĐẠT, reviewer không có "Chặn"). CHƯA kiểm trực quan trình duyệt; CHƯA xác nhận khớp chỗ gắn thật. Phase dự án không đổi.**

- Chọn beacon → chạm bản đồ 3D (một tầng) → Xác nhận; dev server ghi `floorId, x, z, height_m` vào `data/beacons.local.json` (gitignored). Chỉ `npm run dev`, tắt ở `?kiosk`/mobile-flow/build. Client không gửi/nhận UUID.
- File: MỚI `src/positioning/beacon_placement.js`, `tools/beacon_placement_server.mjs`, `src/scene/BeaconLayer.js`, `src/ui/beaconPlacementUI.js`, `tests/beacon_placement.test.mjs`; SỬA `vite.config.js`, `src/main.js`, `index.html`, `package.json` (tên test), `HUONG_DAN.md` (mục 13), `.gitignore`. Sao lưu `*.bak-2026-11-09`.
- Kiểm chứng: `npm test` 140/140; `npm run build` OK; `npm run validate` 0 lỗi/1 cảnh báo cũ; `node --check` OK; route chạy thử trên dữ liệu tạm (403/400/413/415 đúng); `data/beacons.local.json` thật không bị đổi; grep UUID thật sạch.
- Còn lại: 2 mục "Nên sửa" nhỏ của reviewer; hướng trục z; số tầng thực dựng; `beacon-admin` vẫn fetch file có UUID qua dev server.
- Chi tiết: `docs/agent-runs/2026-11-09-1031-gan-beacon-3d.md`.

## CP-BEACON-MAP-PLAN (2026-11-02) — Plan hiện beacon thật trên bản đồ 3D

**Kết quả: Một phần — mới xong khảo sát + plan, CHỜ DUYỆT Cổng 1. Chưa sửa mã sản phẩm; chưa chạy test/build mới.**

- Khảo sát a–e: xem `docs/prompts/2026-11-02-beacon-map-plan.md` (có đường dẫn + dòng). Phase dự án không đổi.
- Plan A (marker beacon, không đổi "Vị trí của bạn") và Plan B (beacon gần nhất → vị trí; chạm Phase 5) tách riêng, có tiêu chí đo được.
- Phát hiện: key dùng gạch ngang chứ không phải dấu hai chấm; F1_B01 chưa gắn phòng; `beacon-map.local.json` trỏ F1_R101 không tồn tại; UI "Cả 3 tầng" vs 9 tầng dữ liệu; tọa độ 10.0/3.2 trùng ví dụ tài liệu (khả năng tạm). Ghi ROADMAP Q30–Q35.
- Không đọc/ghi UUID thật vào tài liệu.

## CP-UI-MOBILE-FLOW (2026-11-02) — Bản thử nghiệm

**Kết quả: Hoàn thành (mã + kiểm thử tự động; verifier kết luận ĐẠT). Đã kiểm tra trực quan trong trình duyệt tích hợp (430×932, 375×667, desktop 1440×900, `?kiosk=1`); CHƯA chạy trên điện thoại thật.**

Luồng di động "Khám phá bản đồ 3D" kiểu Google Maps (S0 khám phá → S1 tìm kiếm → S2 thiết lập tuyến → S3 dẫn đường), chỉ bật ở màn hình ≤700px, không bật ở `?kiosk`, `?force2d`, `?model=glb`. Phase dự án **không đổi** (Chuẩn bị → chờ Phase 0); Phase 4/6 **không** đánh dấu hoàn thành. Dữ liệu vẫn là thử nghiệm.

| Việc | File |
|---|---|
| State machine S0–S3 | `src/ui/mapFlow.js` (MỚI) |
| PositionProvider (ưu tiên beacon → thủ công, có confidence) | `src/positioning/position_provider.js` (MỚI) |
| Geofence (chưa cấu hình → không gọi GPS) | `src/positioning/geofence.js`, `data/geofence.json` (MỚI, unconfigured) |
| Tóm tắt tuyến, chỉ dẫn theo mốc | `src/nav/route_summary.js` (MỚI) |
| CSS (chỉ dưới `body.mobile-flow`) | `src/ui/mobile-flow.css` (MỚI) |
| Test | `tests/map_flow.test.mjs`, `tests/geofence_position.test.mjs` (MỚI, 21 test) |
| Sửa | `index.html` (+111), `src/main.js` (+734/-58), `package.json` (chỉ `scripts.test`), `README.md` (+14) |

Sao lưu: `*.bak-2026-11-02` cho 4 file sửa.

**Kiểm chứng (verifier chạy lại độc lập):**
```
npm test         → 124/124 PASS (baseline 103 + 21 mới); xe lăn trên dữ liệu thật: 78/84 tuyến kiểm, không dùng stairs
npm run build    → OK 2,91 s; main 800,84 kB (cảnh báo >500 kB là cũ); dist có index, scan, beacon-admin
npm run validate → 0 lỗi, 1 cảnh báo (orphan nodes, đã biết)
node --check     → OK 5 file
dev server cổng 5199: /, main.js, mobile-flow.css, data/geofence.json đều 200
grep localStorage/sessionStorage/console.* trên 4 module mới → rỗng
sha256 trước/sau (executor): 5 file data, scan/index.html, beacon-admin.html, vite.config.js giống hệt
Không có script lint
```

**Còn lại / Cần xác nhận:**
- **Đã kiểm tra trực quan** bằng DOM + ảnh chụp trong trình duyệt tích hợp: 430×932 và 375×667 (S0–S3, quay lui), 1440×900 (bố cục desktop giữ nguyên, mobile-flow tắt), `?kiosk=1` ở 430 px (kiosk-mode bật, mobile-flow tắt, không có ô tìm kiếm mới). **Chưa** kiểm trạng thái S3 độ tin cậy thấp và `?from=` bằng mắt; **chưa** chạy trên iPhone/Android thật.
- Tương phản: executor đo chữ #0f2a24/#fff ≈ 15,25; trắng/#0d7a6e ≈ 5,22. Chữ phụ #e6f4f1/#0d7a6e (verifier ước ≈ 4,6) chưa đo công cụ.
- 6/84 phòng F2/F3 không có tuyến xe lăn từ phòng F1 đầu tiên (đặc điểm dữ liệu); UI báo "Không có đường xe lăn giữa hai điểm".
- Nhãn phòng 3D `.room-label` 11px (ngoại lệ chữ ≥16px); nút Forward của trình duyệt không khôi phục state; `fitRouteOverview` chưa bù phần bị sheet che; mobile-flow chưa có phát hiện lệch tuyến.
- Ngưỡng `CONFIDENCE_MIN=0.5`, `STALE_MS=15000`, timeout GPS 8000 ms: Cần xác nhận. `ble_adapter` chưa trả confidence (gán 1).
- Cần xác nhận: bản build có phục vụ `/data/*.json` không (dist không có thư mục data).
- Dữ liệu chưa có trường "khoa" nên tìm theo khoa chưa làm được.

**DoD:**
- [x] S0 chỉ pill + nút tầng + nút vị trí (đọc mã)
- [x] Chọn kết quả → điền sẵn điểm đến
- [x] Bắt đầu → camera tới vị trí hiện tại, tuyến tô tới đích (đọc mã)
- [x] Không có vị trí → có lối chọn thủ công
- [x] Test/build đạt; không cài dependency; không commit/push
- [x] Kiểm tra trực quan (trình duyệt tích hợp) — đã làm, trừ S3 độ tin cậy thấp; thiết bị thật — chưa

---

## CP-tool.2 (2026-11-02)

**Kết quả: Hoàn thành (phần file và tài liệu) — đã tạo lệnh `/hin` và cập nhật tài liệu quy trình. Chưa chạy thử `/hin` (theo prompt, người dùng tự thử).**

Việc về công cụ (phần 2/2). Phase dự án **không đổi**: Chuẩn bị → chờ Phase 0.

| Việc | File | Kết quả |
|---|---|---|
| Lệnh điều phối `/hin` | `.claude/commands/hin.md` | MỚI. Nội dung chép nguyên văn theo prompt |
| Thư mục lưu prompt | `docs/prompts/.gitkeep` | MỚI, file rỗng |
| Phân vai | `CLAUDE.md` mục 1 | Sửa 1 dòng (Antigravity "hoặc qua hin-executor"), thêm 1 dòng vai "Đội thực thi trong Claude Desktop" |
| Quy trình | `docs/WORKFLOW.md` | Thêm mục "Vòng lặp trong Claude Desktop (/hin)" (9 bước), giữ nguyên vòng lặp cũ |

**Kiểm chứng:**
```
Điều kiện tiên quyết: PROJECT_STATUS.md có CP-tool.1; .claude/agents/ có đủ 3 file hin-*.md
.claude/commands/ trước khi tạo → không tồn tại (không ghi đè)
hin.md: 2 dòng '---' (dòng 1 và 4), có 'Yêu cầu: $ARGUMENTS' (dòng 6)
Repo chưa có commit → dùng 'git diff --no-index' so với bản sao lưu trước khi sửa:
  CLAUDE.md: -1 dòng / +2 dòng, chỉ trong mục 1
  docs/WORKFLOW.md: +16 dòng, chỉ thêm mục mới trước "Mẫu prompt thực thi chuẩn"
```

**Còn lại / Cần xác nhận:**
- Chưa chạy `/hin` lần nào. Lệnh và 3 subagent có thể chỉ được nạp khi mở phiên mới (xem CP-tool.1).
- Lệnh thử đề xuất: `/hin Rà ROADMAP và đề xuất bước đầu Phase 0`. Kỳ vọng: lệnh dừng ở cổng duyệt.

---

## CP-tool.1 (2026-11-02)

**Kết quả: Một phần — đã tạo 3 subagent; gọi thử chưa được vì phiên hiện tại chưa nạp agent mới.**

Việc về công cụ (phần 1/2 dựng đội thực thi trong Claude Code). Phase dự án **không đổi**: Chuẩn bị → chờ Phase 0.

| Subagent | File | Công cụ | Vai trò |
|---|---|---|---|
| `hin-planner` | `.claude/agents/hin-planner.md` | Read, Grep, Glob, WebSearch, WebFetch | Soạn prompt thực thi; không sửa file, không chạy lệnh |
| `hin-executor` | `.claude/agents/hin-executor.md` | Read, Grep, Glob, Edit, Write, Bash | Thực thi prompt đã duyệt; không cập nhật PROJECT_STATUS/HANDOVER |
| `hin-verifier` | `.claude/agents/hin-verifier.md` | Read, Grep, Glob, Bash | Kiểm định độc lập theo DoD; không sửa file |

Nội dung 3 file chép đúng nguyên văn theo prompt. Trước khi tạo, `.claude/agents/` chưa tồn tại → không ghi đè file nào (kể cả `hin-executor.md`: chưa có bản cũ để thay).

**Kiểm chứng:**
```
ls .claude/agents (trước khi tạo) → "No such file or directory"
Kiểm frontmatter: mỗi file có đúng 2 dòng '---' (mở dòng 1, đóng sau 'model: inherit'); name khớp tên file
Gọi thử hin-planner → lỗi "Agent type 'hin-planner' not found"
Gọi thử hin-verifier → lỗi "Agent type 'hin-verifier' not found"
```
**Cần xác nhận: Claude Desktop chưa nạp .claude/agents** — danh sách agent được nạp lúc mở phiên; file tạo giữa phiên chưa hiện. Cần mở phiên mới rồi gọi thử lại 2 lệnh chỉ đọc.

**DoD:**
- [x] 3 file agent tồn tại, nội dung đúng
- [x] Gọi thử planner/verifier: đã ghi rõ lý do thất bại (chưa nạp)
- [x] Không cài gì, không commit, không push

---

## CP-NAV-BLE (2026-11-02)

**Kết quả: Hoàn thành — 7 task định vị + dẫn đường + BLE bridge laptop→điện thoại.**

| Việc | File | Kết quả |
|---|---|---|
| Relay middleware HTTP (3 endpoint) | `vite.config.js` | ✓ `/api/loc/new-code`, `/api/loc/push` (localhost-only), `/api/loc/poll` |
| BridgeSource polling phone-side | `src/positioning/bridge_source.js` | ✓ MỚI — polling 2s, timeout 15s (Cần xác nhận) |
| Nav mode HTML (banner, overlay) | `index.html` | ✓ `#nav-mode-overlay`, `btn-start-nav`, `btn-reached-waypoint`, off-route banner, arrived banner |
| Nav mode + bridge CSS | `src/ui/wayfinding.css` | ✓ Thêm ~80 dòng CSS |
| main.js: ?from=, flyTo50°, navMode, mock | `src/main.js` | ✓ 7 function mới: `flyToPositionTilted`, `startNavMode`, `exitNavMode`, `_updateNavBanner`, `_checkOffRoute`, `_connectBridgeSource`, `_setupMockMode` |
| Bridge relay scan page | `scan/index.html` | ✓ RSSI window, hysteresis, pairing code, push đến relay |
| Hướng dẫn demo mục 12 | `HUONG_DAN.md` | ✓ 5 kịch bản A–E |

**Kiểm chứng:**
```
npm test       → 103/103 PASS (không thay đổi)
npm run build  → ✓ built in 5.66s (779.74kB / 205.22kB gzip)
npm run validate → 0 lỗi, 1 cảnh báo (orphan nodes — đã biết)
node --check src/positioning/bridge_source.js → OK
node --check vite.config.js → OK
```

**Fix Rollup parse error:** `}[type] ?? label || type` → `(_map[type] ?? label) || type` (Rollup strict ES2020 yêu cầu parens khi mix `??` và `||`).

**Giới hạn / Cần xác nhận:**
- `POLL_INTERVAL_MS=2000`, `SIGNAL_TIMEOUT_MS=15000`, `OFF_ROUTE_THRESHOLD_M=8` — tất cả "Cần xác nhận" bằng đo thực
- `RSSI_THRESHOLD=-80`, `HYSTERESIS_COUNT=3`, `WINDOW_SIZE=5` trong scan page — "Cần xác nhận"
- `data/beacon-map.json` dùng UUID placeholder `00000001-...` — chưa có UUID thật
- Tất cả test case a–h cần xác minh trực quan trên thiết bị (viewport 430×932)

**DoD UI (cần người dùng kiểm):**
- a) Không có `?from` → app hỏi vị trí
- b) `?from=F1_R001` hợp lệ → camera bay đúng
- c) `?from=INVALID` → toast lỗi, không crash
- d) Tuyến cùng tầng và khác tầng
- e) "Bắt đầu", kéo bản đồ, "Về vị trí"
- f) Mock mode `?mock=1` + marker đi dọc tuyến
- g) Sai pairing code → không nhận
- h) Ngắt bridge → banner "Mất tín hiệu"

---

## CP0-DATA-CORRECTION (2026-11-02)

**Kết quả: Hoàn thành — sửa tài liệu sau phát hiện dữ liệu phòng là sơ đồ mẫu.**

| Phát hiện | Hệ quả |
|-----------|--------|
| `data/rooms.json` F1 sinh từ `sodobenhvienmau.jpg` = sơ đồ mẫu | Tên và geometry phòng không phản ánh BV 7A |
| F2 là bản sao y hệt F1 (diff SVG = 0 dòng) | Mọi roomId F2 đều vô nghĩa cho đến khi có mặt bằng thật |
| 6 phát hiện ảnh không gán được roomId | FIND_003 hủy gán tạm F1_R013; FIND_005 ứng viên F2_R013 vô hiệu |

**Trạng thái dữ liệu phòng: `provisional – sơ đồ mẫu`** (tất cả tầng F1–F9)

**Thay đổi file:**
- `data/survey/photo_findings.json`: FIND_003 → status "chưa gán phòng", roomId null; FIND_005 ghiChu cập nhật
- `HANDOVER.md`: thêm §CP0-DATA-CORRECTION, sửa §CP0-SURVEY-SVG
- `PROJECT_STATUS.md`: mục này

**Kiểm chứng:**
```
python -I (parse photo_findings.json) → 6 mục, 6/6 status="chưa gán phòng"
node tools/validate_data.mjs         → 0 lỗi, 1 cảnh báo (đã biết)
```

**Câu hỏi mở:** Lấy mặt bằng thật F1/F2 (bản vẽ kiến trúc hoặc sơ đồ PCCC) trước khi tiếp tục gán phòng. Xem HANDOVER.md §CP0-DATA-CORRECTION.

---

## CP-DEV-LAN (2026-11-02)

**Kết quả: Hoàn thành — dev server in link LAN, xác nhận HTTP 200 từ IP LAN.**

| Việc | File | Kết quả |
|---|---|---|
| Script in IP LAN + spawn vite --host 0.0.0.0 | `tools/dev-lan.mjs` | ✓ Node built-in only (os, child_process, path, url) |
| Thêm script `dev:lan` | `package.json` | ✓ Chỉ thêm 1 dòng, không sửa script `dev` |
| Mục hướng dẫn điện thoại + giới hạn HTTP | `README.md` | ✓ Mục mới "Truy cập từ điện thoại khi dev" |

**Kiểm chứng:**
```
node --check tools/dev-lan.mjs   → SYNTAX OK
npm run dev:lan                  → in Local: http://localhost:5173 + Network: http://172.16.29.100:5173
                                   Vite in "Network: http://172.16.29.100:5175/" xác nhận --host 0.0.0.0
curl http://172.16.29.100:5173/  → HTTP 200
npm test                         → 103/103 PASS
package.json dependencies        → three 0.186.1 (không thay đổi)
script dev                       → vite (không thay đổi)
```

**Giới hạn / Cần xác nhận:**
- Điện thoại truy cập link `http://<IP>`: cần người dùng tự kiểm thử (Cần người dùng xác nhận).
- Firewall Windows Defender có thể hỏi quyền lần đầu — chọn "Allow" cho Private network.
- `http://` không phải secure context: camera, la bàn, Web Bluetooth sẽ không hoạt động.

---

## CP0-SURVEY-SVG (2026-11-02)

**Kết quả: Hoàn thành — SVG F1/F2, nhật ký photo_findings.json, xác định ứng viên giếng trời F2.**

| Việc | File | Kết quả |
|---|---|---|
| Script xuất SVG mặt bằng | `tools/gen_floor_svg.py` | ✓ Python standard-lib only |
| SVG Tầng trệt F1 | `docs/survey/F1.svg` | ✓ 42 phòng, 42/42 nhãn, landmark F1_R013 |
| SVG Tầng 2 F2 | `docs/survey/F2.svg` | ✓ 42 phòng, 42/42 nhãn, landmark F2_R013 |
| Nhật ký khảo sát | `data/survey/photo_findings.json` | ✓ 6 phát hiện, 6 landmark, 1 đã gán, 5 chưa gán |
| F1_R013 ghi chú | Không sửa file room (schema thiếu trường ghi chú) → ghi vào FIND_003 | ✓ đúng quy tắc |
| Ứng viên giếng trời F2 | F2_R013 — **vô hiệu** (F2 sao chép F1, dữ liệu mẫu) | ✗ đã sửa |

**Kiểm chứng:**
```
python -I tools/gen_floor_svg.py  → F1: 42/42, F2: 42/42 nhãn
python -I (parse JSON)            → 6 mục, IDs duy nhất, 6/6 landmark
node tools/validate_data.mjs      → 0 lỗi, 1 cảnh báo (orphan nodes đã biết)
```

**Câu hỏi mở → mang về Claude Chat:** Xem HANDOVER.md §CP0-SURVEY-SVG.

---

## CP0-PHOTO-ALIGN (2026-11-02)

**Kết quả: Phần A hoàn thành — gỡ tính năng "Đi theo ảnh"; Phần B hoàn thành — bảng đối chiếu ảnh vs. sơ đồ 3D; Phần C chờ duyệt.**

| Việc | File | Kết quả |
|---|---|---|
| Gỡ `src/streetview/StreetView.js` + `streetview.css` | `src/streetview/` (xóa cả thư mục) | ✓ |
| Xóa `data/routes.json`, `data/layout-schematic.json`, `docs/mobile-testing.md` | — | ✓ |
| Sửa `index.html` | Xóa CSS link, nav button, panel HTML | ✓ |
| Sửa `src/main.js` | Xóa import StreetView + block wire-up | ✓ |
| Giữ `data/photo-nodes.json`, `docs/photo-survey.md` | — | ✓ |
| Tests | `npm test` | **103/103 PASS** |
| Build | `npm run build` | **OK** (774KB/203KB gzip) |
| Bảng đối chiếu ảnh vs. sơ đồ 3D | Xem HANDOVER.md §CP0-PHOTO-ALIGN | Chờ duyệt |

**Không tìm thấy** "script dev LAN" trong package.json hay vite.config.js — không có gì để gỡ.

**Câu hỏi mở → mang về Claude Chat:** Xem bảng đối chiếu ảnh trong HANDOVER.md §CP0-PHOTO-ALIGN và quyết định mục nào cần sửa (Phần C).

---

## CP0-STREETVIEW-PROTO (2026-11-02)

**Kết quả: Hoàn thành nguyên mẫu street view (Phương án B) — tích hợp với viewer 3D và Map2D hiện có.**

| Việc | File | Kết quả |
|---|---|---|
| Thêm `verified` field vào photo-nodes.json | `data/photo-nodes.json` | ✓ 15 node; PH_001–005, PH_010–012 = true; PH_006–009, PH_013–015 = false |
| Tạo tọa độ sơ đồ | `data/layout-schematic.json` | ✓ 15 node, coordSys 20×12, đơn vị schematic |
| Tạo dữ liệu tuyến đường | `data/routes.json` | ✓ 2 segment verified: seg_F1_lobby (PH_001–005), seg_F2_corridor (PH_010–012) |
| StreetView component | `src/streetview/StreetView.js` | ✓ Photo viewer, privacy filter, prev/next, swipe, preload, Map2D minimap, search, floor selector |
| Street view styles | `src/streetview/streetview.css` | ✓ Mobile-first, safe-area, 44px touch targets |
| Nav button "Đi theo ảnh" | `index.html` | ✓ Trong `.hospital-nav`, cùng style active |
| CSS streetview link | `index.html` | ✓ |
| Street view panel HTML | `index.html` | ✓ `#streetview-panel` fullscreen overlay |
| Wire-up main.js | `src/main.js` | ✓ Lazy-init StreetView, active state, không phá initApp |
| Tests mới | `tests/streetview.test.mjs` | ✓ 18 test cases |
| Checklist mobile | `docs/mobile-testing.md` | ✓ 10 mục |

**Kiểm chứng:**
```
node --test ... tests/streetview.test.mjs  →  121/121 pass (18 test mới + 103 cũ)
curl http://localhost:5173/                →  HTTP 200
LAN URL: http://172.16.29.100:5173/
```

**Giới hạn / cần xác nhận:**
- `assets/survey-photos/` chưa có ảnh thực → privacy nodes hiện placeholder; các node không-privacy hiện ảnh broken (404 graceful)
- Map2D minimap dùng tọa độ schematic — chưa phản ánh layout thực
- Ảnh F3 chưa có → tuyến bị đứt sau PH_012

**Câu hỏi mở:** xem HANDOVER.md §CP0-STREETVIEW-PROTO.

---

## CP0-PHOTO-SURVEY (2026-11-02)

**Kết quả: Hoàn thành phân tích 15 ảnh khảo sát thực địa → photo-nodes.**

| Việc | File | Kết quả |
|---|---|---|
| Phân tích 15 ảnh (2 lô × ≤10) | — | ✓ 15/15 node; mỗi ảnh đọc đúng 1 lần |
| Thứ tự ảnh | tên file 1–15 | EXIF không có; dùng tên file làm thứ tự |
| Tạo `data/photo-nodes.json` | `data/photo-nodes.json` | 15 node, JSON hợp lệ |
| Tạo `docs/photo-survey.md` | `docs/photo-survey.md` | Bảng phân tích, bảng so sánh T1/T2, bảng privacy, 10 câu hỏi |
| Cập nhật ROADMAP.md câu hỏi mở | `ROADMAP.md` | Thêm Q20–Q24 |
| Cập nhật HANDOVER.md | `HANDOVER.md` | Mục CP0-PHOTO-SURVEY |

**Kiểm chứng:**
```
python -I -c "import json; nodes=json.load(open('data/photo-nodes.json')); print(len(nodes),'nodes')"
→ 15 nodes
Tất cả 7 kiểm tra DoD: PASS (ID duy nhất, seq 1-15, prev/next hợp lệ, chuỗi liên mạch, landmark confidence hợp lệ)
```

**Phát hiện chính:**
- F1 (Tầng trệt/Sảnh): PH_001–005 chắc chắn; PH_006–008 ước lượng (hành lang tile trắng, khác marble sảnh)
- F2 (Tầng 1): PH_009–012 ước lượng; PH_012 có bằng chứng mạnh (lan can kính nhìn xuống khu chờ)
- PH_013–015: F2 hay F3 — **không xác định**, cần ảnh bổ sung
- **F3 (Tầng 2): chưa có ảnh xác nhận**

**Chưa làm (ngoài phạm vi phiên này):**
- Dựng navigation graph, UI, BLE
- x, z, yawDeg (cần sơ đồ mặt bằng)
- Ảnh T2 (F3) chưa chụp
- `assets/survey-photos/` chưa tạo (ảnh gốc ở temp, chưa di chuyển vào repo)

**Câu hỏi mở → mang về Claude Chat:** xem Q20–Q24 trong ROADMAP.md và §7 trong docs/photo-survey.md.

---

## CP-BEACON-SETUP (2026-10-30)

**Kết quả: Hoàn thành 9 việc — 4 script mới, 1 script sửa, tests 24/24 pass, tài liệu cập nhật.**

| Việc | File | Kết quả |
|---|---|---|
| git check-ignore beacons.local.json | `.gitignore:43` | ✓ bị gitignore |
| Script tạo UUID dự án | `tools/beacon_setup/new_project_uuid.ps1` | Tạo beacons.local.json từ example; không in UUID; không ghi đè nếu đã có |
| Script validate beacon | `tools/beacon_setup/validate_beacons.py` | 8 kiểm tra: id pattern, major/minor, floorId, trùng, UUID, x/z, status; exit ≠ 0 khi lỗi |
| Allowlist tự động | `tools/beacon_bridge/bridge.py` | Thêm `--beacons` arg; tự build allowlist từ beacons.local.json; ≤1 file, không đổi giao thức |
| Script chẩn đoán bridge | `tools/beacon_setup/diagnose_beacons.py` | Kết nối WebSocket, so với file, báo KHỚP/LỆCH/THIẾU; UUID chỉ hiện 4 ký tự |
| Script tổng hợp hiệu chỉnh | `tools/beacon_setup/summarize_calibration.py` | Thống kê+IQR, hồi quy log-distance (A, n, R²), cảnh báo, đề xuất rssiAt1m |
| Tests | `tools/beacon_setup/test_beacon_setup.py` | 24/24 pass: validate(13), IQR(3), regression(4), CSV parse(2), PS script(2) |
| Liệt kê COM thật | PowerShell | COM7: Silicon Labs CP210x (CP2102) — OK; COM3-6: Bluetooth serial |
| Timeout mất tín hiệu | `src/beacon-admin/main.js:12` | `LOST_TIMEOUT_MS = 10_000` (10 giây) — khớp yêu cầu, không cần đổi |
| Quy ước Major/Minor | `docs/DATA_MODEL.md` | Thêm mục "Quy ước Major/Minor (chốt)" |
| Script trong HUONG_DAN | `HUONG_DAN.md` | Chèn B1 (new_project_uuid), D1 (validate), E5 (diagnose), F3 (summarize) |

**Kiểm chứng thực tế:**
- `python -m unittest tools/beacon_setup/test_beacon_setup.py -v` → **24/24 pass**
- `git check-ignore data/beacons.local.json` → `.gitignore:43:data/beacons.local.json`
- `python tools/beacon_setup/validate_beacons.py` → LỖI đúng: "File phải là JSON array" (beacons.local.json hiện là single object — người dùng cần sửa thành array)
- `python tools/beacon_setup/summarize_calibration.py <CSV tổng hợp>` → A=-62.1 (true -62.0), n=2.238 (true 2.3), R²=0.9977
- `python tools/beacon_bridge/bridge.py --help` → thấy `--beacons` arg mới
- Cổng COM thật: COM7 CP2102 OK, COM3-6 BT serial OK

**Lưu ý quan trọng:**
- `data/beacons.local.json` **hiện là single JSON object, không phải array** — phải sửa thành array hoặc chạy new_project_uuid.ps1 để tạo lại.
- UUID trong beacons.local.json hiện tại chưa được sinh bằng new_project_uuid.ps1 (do ai đó điền tay).

---

## CP-BEACON-BRIDGE (2026-10-30)

**Kết quả: Hoàn thành cầu nối Python BLE → WebSocket và trang quản trị kỹ thuật viên.**

| Việc | File | Kết quả |
|---|---|---|
| Module giải mã iBeacon thuần Python | `tools/beacon_bridge/ibeacon.py` | `decode_ibeacon()`, `build_key()`, `mask_key()`; 13 unit tests Python pass |
| Cầu nối Python | `tools/beacon_bridge/bridge.py` | BleakScanner → allowlist → throttle 5/s → WebSocket 127.0.0.1 |
| Cài gói Python | `tools/beacon_bridge/requirements.txt`, `.venv` | bleak==0.22.3, websockets==13.1; venv riêng |
| Bảo vệ UUID | `.gitignore`, `tools/beacon_bridge/.gitignore` | `allowlist.json`, `data/beacons.local.json` đã gitignore |
| File mẫu cho người dùng | `tools/beacon_bridge/allowlist.json.example`, `data/beacons.local.example.json` | Mô tả format + hướng dẫn |
| Sliding window RSSI | `src/beacon-admin/smoothing.js` | `SlidingWindow` class |
| Nguồn dữ liệu beacon | `src/beacon-admin/sources.js` | `LaptopBridgeSource` (WebSocket + auto-reconnect), `MockReplaySource` (5 kịch bản) |
| Trang kỹ thuật viên | `beacon-admin.html`, `src/beacon-admin/main.js` | Danh sách beacon, "Gán vị trí", CalibrationRecord |
| Vite entry mới | `vite.config.js` | `'beacon-admin': './beacon-admin.html'` |
| Tests JS | `tests/beacon_admin.test.mjs` | 20 tests (SlidingWindow 7, MockReplaySource 6, LaptopBridgeSource 7) |
| README + HUONG_DAN | `README.md`, `HUONG_DAN.md` | Mục "Trang quản trị Beacon" và cập nhật §2 đo RSSI |

**Kiểm chứng thực tế:**
- `npm test` → **103/103 pass** (83 cũ + 20 mới)
- `npm run build` → OK; `dist/beacon-admin.html` được tạo ra
- `npm run validate` → 0 lỗi
- Python: `python -m unittest test_ibeacon -v` (trong `tools/beacon_bridge/`) → **13/13 pass**
- `python bridge.py --help` → syntax OK, usage rõ
- `git check-ignore data/beacons.local.json` → bị gitignore
- `git check-ignore tools/beacon_bridge/allowlist.json` → bị gitignore
- Grep UUID thật → không có trong file được track

**Chưa kiểm (cần phần cứng thật):**
- Cài bleak/websockets (cần internet): `cd tools/beacon_bridge && .venv/Scripts/activate && pip install -r requirements.txt`
- Bật bridge + kết nối beacon-admin.html với TEL0149 thật
- Đo RSSI, ghi CalibrationRecord, xuất file JSON
- Kiểm tra marker đổi trạng thái đúng trong trang beacon-admin

---

## CP-BLE-REAL (2026-10-30)

**Kết quả: Hoàn thành bản thử nghiệm beacon thật (Run in RAM).**

| Việc | File | Kết quả |
|---|---|---|
| Gitignore bảo vệ UUID thật | `.gitignore` | Thêm `data/beacon-map.local.json` và `bench/measurements/*.csv` |
| Template cấu hình beacon thật | `data/beacon-map.local.json` | File mới, gitignored, chủ dự án tự điền UUID thật |
| Thư mục kết quả đo | `bench/measurements/.gitkeep` | Thư mục mới, CSV sẽ gitignored |
| Module tải bảng ánh xạ có thể test | `src/positioning/load_beacon_map.js` | Tách logic fetch; ưu tiên local → fallback placeholder |
| Adapter dùng local map | `src/main.js` | `_startBLEAdapter()` dùng `loadBeaconMap()`; toast phân biệt local/placeholder; banner lost |
| Nút tải local trên bench | `bench/index.html` | Nút "Tải local (beacon-map.local.json)" + hint nguồn + tên CSV có timestamp |
| Bảng đo trống | `docs/HARDWARE.md` | Mục 9 mới: bảng kết quả 10 mốc ĐỂ TRỐNG + tham số hiện tại |
| Script đề xuất ngưỡng | `tools/suggest-thresholds.mjs` | Node.js thuần, chỉ in stdout, không tự ghi file |
| Tests | `tests/ble_adapter.test.mjs` | +2 test: loadBeaconMap local/fallback (synthetic) |
| Hướng dẫn vận hành | `HUONG_DAN.md` | Mục 10 (?beacon=real), mục 11 (?at= iPhone LAN) |

**Kiểm chứng thực tế:**
- `npm test` → **83/83 pass** (+2 test mới cho loadBeaconMap)
- `npm run build` → OK, không lỗi mới (cảnh báo chunk >500 kB là cũ)
- `git check-ignore data/beacon-map.local.json` → `.gitignore:42:data/beacon-map.local.json`
- `git check-ignore bench/measurements/test.csv` → `.gitignore:45:bench/measurements/*.csv`
- Grep UUID thật trong src/data/bench/tests → không có (chỉ `00000001` placeholder và UUID zero của test)
- `node tools/suggest-thresholds.mjs` với CSV synthetic → in đề xuất ngưỡng đúng, không tự ghi file

**Chưa kiểm (cần phần cứng thật):**
- Bật `?beacon=real` trên Chrome/Edge với beacon Run in RAM thật — chủ dự án tự làm
- Tắt beacon → xác nhận banner "Mất tín hiệu" hiện trong ≤10 giây — chủ dự án tự làm
- `?at=F1_R001` trên iPhone Safari qua LAN — chủ dự án tự làm
- Đo RSSI thực tế 10 mốc và điền bảng `docs/HARDWARE.md` mục 9

---

## CP-BLE-INTEGRATION (2026-10-28)

**Kết quả: Hoàn thành 4 việc theo plan đã duyệt.**

| Việc | File | Kết quả |
|---|---|---|
| Sửa lỗi bench `startReal is not defined` | `bench/index.html` | Xóa 8 dòng gán `window.*` sớm (dạng undefined) |
| `?at=<roomId>` qua URL/QR | `src/main.js` | Đặt vị trí xuất phát, toast, không crash khi id sai |
| Trang `/scan/` + vite multi-page + gen_qr_links | `scan/index.html`, `vite.config.js`, `tools/gen_qr_links.mjs` | Build ra `dist/scan/index.html`; fallback iPhone |
| BLE adapter + nối vào app | `src/positioning/ble_adapter.js`, `data/beacon-map.json`, `src/main.js` | Dynamic import khi `?beacon=real`; type `'ble'` trong status |

**Kiểm chứng thực tế:** `npm test` → **81/81 pass** (+6 test mới); `npm run build` → OK, không lỗi; `dist/scan/index.html` có mặt; `data/beacon-map.json` không chứa UUID thật.
**Chưa kiểm:** bench trên trình duyệt thật, `?at=` trên iPhone, `/scan` trên Chrome Android, `?beacon=real` với beacon phát thật.

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

**Cập nhật lần cuối:** 2026-10-26 (CP-THREE-FLOOR-UI: giao diện ổn định, Tầng trệt/Tầng 1/Tầng 2)
**Phase hiện tại:** Prototype P0.5 + pipeline 3D F1 tạm (CP-3D-PIPELINE); chưa xác nhận DoD phase chính thức.

---

## Phê duyệt đặc biệt của chủ dự án (phiên này)

Chủ dự án đã **phê duyệt rõ ràng** trong phiên 2026-10-26:
1. **Cài skill `frontend-design`** từ `github.com/anthropics/skills` vào `.claude/skills/frontend-design/`.
2. **Làm giao diện ngoài phase hiện tại** dưới nhãn **"Bản thử nghiệm – Dữ liệu thử nghiệm"**, không coi là phase chính thức.
3. **Nâng cấp lớp trình bày** (phiên Visual 3D): hệ tier, diện mạo mới, hiệu ứng, UI.

Trạng thái: **Bản thử nghiệm – chưa đạt DoD của phase nào**.

---

## Trạng thái hiện tại

- **Prototype P0.5 + UI nâng cấp Visual 3D:** Web app 3D với diện mạo y tế sáng, tier system, tween, route effects, UI glassmorphism.
- Đã có ảnh sơ đồ mẫu sodobenhvienmau.jpg và GLB F1 tạm; dữ liệu dẫn đường/beacon vẫn mô phỏng, chưa xác nhận kích thước và sơ đồ hiện trường.
- Git repo: chưa commit (đúng yêu cầu).
- Remote: `https://github.com/QuocHuy-Dev-FS/Hospital-Indoor-Navigation.git` (repo trống, chưa push).

---

## File đã sửa/tạo phiên này (2026-10-26, Visual 3D)

### File mới
- `docs/VISUAL_DESIGN.md` — bảng màu, tier config, số đo trước/sau, mục chưa xác minh
- `src/quality/QualityManager.js` — hệ tier low/medium/high, auto-downgrade FPS, render-on-demand, WebGL fallback
- `src/utils/tween.js` — module tween nội bộ, easing functions, TweenManager
- `src/scene/RouteRenderer.js` — vẽ route draw-on, shader chạy dọc tuyến, đa tầng, pin đích
- `src/scene/PositionMarker.js` — marker với pulse ring, hướng, low-confidence

### File đã sửa
- `src/scene/SceneBuilder.js` — màu theo loại phòng, EdgesGeometry, tường sứ, dispose đúng cách, splitRouteByFloor, labelPriority
- `src/main.js` — tích hợp QualityManager+tween+RouteRenderer+PositionMarker, render-on-demand, WebGL fallback, intro animation, fly-to camera, debug overlay (?debug=1), floor-strip dọc, saving mode button, btn-reset-view
- `src/styles.css` — nền sáng y tế, glassmorphism sheet, floor-strip, saving mode, a11y, WebGL fallback
- `index.html` — thêm: floor-strip, btn-saving-mode, btn-reset-view, webgl-fallback placeholder
- `tests/nav.test.mjs` — +17 tests: tween (easing/interpolate/cancel), TweenManager, splitRouteByFloor, labelPriority

---

## Checkpoints

- CP0 (2026-10-23): Khung tài liệu hoàn tất.
- CP-SKILL (2026-10-23): 3 skill tùy chỉnh.
- CP-SAMPLE3D-A (2026-10-23): Git remote; scaffolding; Python pipeline modules.
- CP-P0.5 (2026-10-26): Prototype web 3D hoàn chỉnh.
- CP-UI (2026-10-26): Giao diện "Bản thử nghiệm" hoàn thiện.
- **CP-VISUAL3D (2026-10-26):** Nâng cấp lớp trình bày 3D. Xem bên dưới.
- **CP-HARDWARE-DOCS (2026-10-26):** Tài liệu phần cứng beacon TEL0149 và mô hình triển khai. Xem bên dưới.
- **CP-BENCH-TOOL (2026-10-26):** Công cụ bench BLE: packet-parser, room-resolver, beacon-source (thật + giả lập), trang bench HTML, tests 72/72 pass. Xem bên dưới.

### Kiểm chứng CP-VISUAL3D (2026-10-26)

| Kiểm tra | Kết quả |
|---|---|
| `node tools/validate_data.mjs` | ✓ 0 lỗi, 1 cảnh báo (27 nút ngoại vi — đã biết) |
| `npm test` | **35/35 pass** (13 suites, tăng từ 18→35 tests) |
| `npm run build` | ✓ 5.39s — JS 662KB/172KB gzip, CSS 18.76KB/4.04KB gzip |
| `npm run dev` trình duyệt | **Chưa xác minh trực quan** — không có trình duyệt trong phiên này |
| Dependencies | `three` 0.186.1 + `vite` — không thêm gói mới |

---

## CP-3D-FIX (2026-10-26)

| Kiểm tra | Kết quả |
|---|---|
| `npm test` | ✓ **45/45** pass — không có test mới, không có test hỏng |
| `npm run build` | ✓ JS 666KB/173KB gzip, sampleModel chunk mới 4.63KB, Map2D 4.23KB |
| Dev server `http://localhost:5173` | ✓ HTTP 200, tất cả `/data/*.json` phục vụ 200 |
| `#three-canvas` có trong HTML | ✓ (xác nhận qua curl) |
| `#webgl-fallback` có `hidden` | ✓ — không hiển thị mặc định |
| Bản đồ 3D thật trên trình duyệt | **Chưa xác minh trực quan** — cần chủ dự án mở `http://localhost:5173` |

### File đã sửa/tạo (phiên fix 3D display)
| File | Thay đổi |
|---|---|
| `src/main.js` | Xóa `hasWebGL()` blocking gate; guard NaN trong `onResize()`; tách `_buildScene()`; `loadAll()` dùng sample model khi data thất bại |
| `src/scene/sampleModel.js` | **MỚI** — dữ liệu mẫu hardcoded 2 tầng/11 phòng, dùng khi `/data/*.json` không tải được |
| `index.html` | Thêm `#sample-data-badge` |
| `src/styles.css` | Thêm style cho `#sample-data-badge` |

## CP-WEBGL-ROOTCAUSE (2026-10-26)

| Kiểm tra | Kết quả |
|---|---|
| `npm test` | ✓ **45/45** pass (tăng từ 35→45, thêm 10 test mới) |
| `npm run build` | ✓ JS 666KB/173KB gzip, Map2D chunk riêng 4.23KB |
| `?force2d=1` hoạt động | ✓ (logic — chưa xác minh trực quan) |
| Thử trên Cốc Cốc thật | **Chưa kiểm** — cần chủ dự án thực hiện |

### File đã sửa/tạo (phiên root-cause + 2D map)
| File | Thay đổi |
|---|---|
| `src/quality/QualityManager.js` | `hasWebGL()`: dùng canvas riêng mỗi lần thử — ngăn canvas bị "khóa" context type |
| `src/main.js` | `showWebGLFallback(reason, error)`: hiện lỗi thật + copy button; `_load2DMode(isForce)`: thay `_loadFallbackSearch`; `?force2d=1` support |
| `src/map2d/Map2D.js` | **MỚI** — SVG map: phòng màu theo loại, nhãn, route polyline, floor tabs, highlight |
| `index.html` | `#webgl-fallback`: thêm `#fb-error-area`, `#fb-error-msg`, `#fb-copy-error`, `#map2d-area`, `#fb-2d-nav` |
| `src/styles.css` | Thêm `.map2d-*`, `.fb-copy-wrap`, `.fb-error-msg`, `.fb-2d-nav` styles |
| `tests/map2d.test.mjs` | **MỚI** — 10 tests: metersToSVG (5) + hasWebGL mock DOM (5) |
| `package.json` | test script thêm `tests/map2d.test.mjs` |
| `README.md` | localhost requirement, URL params table, hướng dẫn F12 debug |

---

## Chưa kiểm thử (cần chủ dự án tự kiểm)

1. Diện mạo mới (nền sáng, màu phòng theo loại, tường sứ, viền cạnh)
2. Intro animation bỏ qua được bằng tap/click
3. Tier detection + auto-downgrade FPS (mở DevTools → Performance → CPU slowdown)
4. Saving mode button (🔋) trong header
5. Floor strip dọc bên phải bản đồ
6. Camera fly-to khi chọn phòng / chọn bước chỉ dẫn
7. Route draw-on animation + hiệu ứng chạy dọc tuyến
8. Pulse animation marker vị trí (chu kỳ 2s)
9. Pin đích drop-in bounce
10. OutlinePass phòng được chọn (chỉ tier high)
11. Debug overlay: `npm run dev` rồi thêm `?debug=1` vào URL
12. Reset góc nhìn (🔄)
13. FPS/draw calls thực tế (đo qua `?debug=1`)
14. WebGL fallback (thử trên trình duyệt không hỗ trợ WebGL)
15. Glassmorphism bottom sheet: backdrop-filter hoạt động

---

## Bước tiếp theo

1. **[USER]** Chạy `npm run dev`, kiểm tra giao diện mới.
2. **[USER]** Mở `?debug=1` để đo FPS, draw calls — điền vào `docs/VISUAL_DESIGN.md` mục 6.
3. **[USER]** Thử trên thiết bị yếu (CPU throttle) để xác nhận tier auto-downgrade.
4. **[USER]** Đối chiếu ảnh sơ đồ mẫu đã có với hiện trường; xác nhận tỉ lệ --ref-px/--ref-m và hướng Bắc (Q-3D-1..2).
5. **[CHAT]** Xem xét các hiệu ứng nghi ngờ nặng (EdgesGeometry × 378 phòng, OutlinePass) — điều chỉnh ngưỡng tier.
6. **[USER]** Đối chiếu SKU bo beacon (xem ROADMAP Phase 0 bước 4a–4b); thử Run in RAM theo HUONG_DAN.md mục 8; bench test RSSI theo mục 7.
7. **[CHAT]** Chốt chính sách Burn và mô hình mốc (ROADMAP bước 4f) sau khi có kết quả bench test.

## CP-HARDWARE-DOCS (2026-10-26)

| Kiểm tra | Kết quả |
|---|---|
| Tải PDF datasheet (1.85 MB) | ✓ HTTP 200, `%PDF` xác nhận |
| Tải PDF schematics (55 KB) | ✓ HTTP 200, `%PDF` xác nhận |
| Tải PDF dimension (56 KB) | ✓ HTTP 200, `%PDF` xác nhận |
| Tạo `docs/HARDWARE.md` | ✓ Có bảng thông số, Run in RAM/Burn, Mâu thuẫn, Chưa xác minh, Tài liệu |
| Cập nhật `docs/ARCHITECTURE.md` (mục 9–10) | ✓ Mô hình proximity/zone, thiết bị thử nghiệm, rủi ro Burn |
| Cập nhật `ROADMAP.md` (bước 4a–4f, DoD, Câu hỏi mở Q12–19) | ✓ |
| Cập nhật `docs/DATA_MODEL.md` (trường beacon/room mới) | ✓ configMode, roomId, beaconId, ràng buộc DỰ KIẾN |
| Cập nhật `HUONG_DAN.md` (mục 7–8 + cảnh báo Burn) | ✓ |
| Cập nhật `README.md` (proximity/zone, thư mục hardware) | ✓ |
| Cập nhật `CLAUDE.md` (quy tắc 10 cấm Burn) | ✓ |
| `npm test` | ✓ **45/45** pass — không test nào hỏng |
| Trực quan giao diện | Chưa xác minh — cần chủ dự án mở trình duyệt |

---

## CP-BENCH-TOOL (2026-10-26)

| Kiểm tra | Kết quả |
|---|---|
| `npm test` | ✓ **72/72** pass (tăng từ 45→72, thêm 27 test bench mới) |
| Không dependency mới | ✓ |
| Phase không đổi | ✓ vẫn Prototype P0.5 |
| Nguồn giả lập chạy đủ 5 kịch bản | ✓ (logic — chưa xác minh trực quan trên trình duyệt) |
| Nguồn thật có mã (Web Bluetooth) | ✓ có mã — chưa kiểm chứng phần cứng (beacon chưa xác nhận phát iBeacon) |
| Bộ phân giải beacon→phòng | ✓ RoomResolver, đủ điều kiện kết luận, hysteresis, fallback mất tín hiệu |
| Trang bench chạy trên localhost | Chưa xác minh trực quan — cần chủ dự án mở http://localhost:5173/bench/index.html |
| Nối vào app (?beacon=) | DỪNG — ghi Câu hỏi mở (xem HANDOVER.md) |
| grep UUID thật | ✓ không có |

### File đã tạo (CP-BENCH-TOOL)

| File | Vai trò |
|---|---|
| `bench/packet-parser.js` | Phân tích gói iBeacon, Eddystone, unknown; tạo manufacturerData giả |
| `bench/room-resolver.js` | RoomResolver: làm mượt RSSI, IQR, hysteresis, minConsecutive, fallback mất tín hiệu |
| `bench/beacon-source.js` | RealSource (Web Bluetooth, feature detection), SimulatedSource (5 kịch bản, hạt giống) |
| `bench/beacon-map-sample.json` | Bảng ánh xạ mẫu (placeholder, không UUID thật) |
| `bench/index.html` | Trang bench: kiểm tra trình duyệt, quét BLE, giả lập, bảng gói, resolver, CSV |
| `bench/README.md` | Tài liệu bench, cách bật cờ, giới hạn, tham số |
| `tests/bench.test.mjs` | 27 test: packet-parser (16), room-resolver (11) — dữ liệu tổng hợp |
| `package.json` | Thêm `tests/bench.test.mjs` vào test script |
| `HUONG_DAN.md` | Thêm mục 9 trỏ tới bench/ |

---

---

## CP-3D-PIPELINE (2026-10-26)

Pipeline Python chuyển ảnh sơ đồ → GLB 3D + 6 PNG render.

| Kiểm tra | Kết quả |
|---|---|
| `py tools/build_floor.py --image assets/floorplans/sodobenhvienmau.jpg` | ✓ XONG trong ~50s |
| Tường phát hiện | ✓ 1457 đoạn (cải thiện từ 39 do fix `minLineLength`) |
| Cửa phát hiện | ✓ 586 (đã giảm từ 865 do tăng `param2`) |
| Phòng flood-fill | ✓ 73 phòng (14 có nhãn, 59 unlabeled) |
| Paths skeleton | ✓ 3 path (từ contour blue mask — không có ximgproc) |
| GLB dollhouse | ✓ `F1_dollhouse_provisional.glb` — 856 KB, 1601 mesh, 19212 tri |
| GLB full | ✓ `F1_full_provisional.glb` — 835 KB, 1601 mesh, 19212 tri |
| GLB verify (trimesh.load) | ✓ cả hai đọc được, mesh/tri count khớp |
| 6 PNG render | ✓ NE/NW/SE iso, full, topdown, overlay |
| `npm run build` sau khi patch main.js | ✓ 754KB/197KB gzip — không lỗi |
| Trực quan ảnh render | **Cần chủ dự án xem** `tools/out/F1_iso_dollhouse_NE.png` |

### File đã tạo/sửa (CP-3D-PIPELINE)

| File | Vai trò |
|---|---|
| `tools/build_floor.py` v2 | Pipeline hoàn chỉnh: mask → wall → room → 3D GLB → 6 PNG |
| `tools/out/F1_paths_mask.png` | Mặt nạ đường xanh |
| `tools/out/F1_walls_mask.png` | Mặt nạ tường |
| `tools/out/walls.json` | 1457 đoạn tường (BẢN NHÁP) |
| `tools/out/doors.json` | 586 cửa (BẢN NHÁP) |
| `tools/out/paths_draft.json` | 3 path contour (BẢN NHÁP) |
| `tools/out/rooms_draft.json` | 73 phòng flood-fill (BẢN NHÁP) |
| `data/coordinate_system_F1_provisional.json` | M=0.01640 m/px (TẠM) |
| `assets/models/F1_dollhouse_provisional.glb` | Mô hình 3D dollhouse |
| `assets/models/F1_full_provisional.glb` | Mô hình 3D toàn chiều |
| `tools/out/F1_iso_dollhouse_NE/NW/SE.png` | Render isometric |
| `tools/out/F1_iso_full.png` | Render full height |
| `tools/out/F1_topdown.png` | Render nhìn từ trên |
| `tools/out/F1_overlay.png` | Overlay lên ảnh gốc |
| `src/main.js` | +GLTFLoader import, +`_loadGLBIntoScene()`, +nhánh `?model=glb` |
| `tools/webgl_check.html` | Kiểm tra WebGL/GPU, standalone (double-click) |
| `tools/README_build.md` | Tài liệu chạy pipeline |

### Tự đánh giá ≥5 lỗi thẩm mỹ hiện tại

1. Walls từ HoughLinesP nhiễu nhiều (cross-hatch + cầu thang bị cắt thành segment ngắn)
2. Sàn phòng dùng bbox hình chữ nhật → các phòng liền kề chồng lấn nhau
3. Kích thước và vị trí cầu thang chỉ là ước lượng từ seed pixel
4. Shader chưa có Ambient Occlusion (thiếu shadow chân tường/góc phòng)
5. Label đặt tại centroid bbox → một số phòng nhỏ bị label ra ngoài bounds
6. Hướng Bắc la bàn chưa xác nhận — hiển thị "N?"
7. Path strips từ contour eroded — hình dạng không phản ánh đúng centerline hành lang

### Câu hỏi mở (mang về Claude Chat)

- Hướng Bắc của tòa nhà so với ảnh là bao nhiêu độ?
- Kích thước thực cần xác nhận để tính `--ref-px --ref-m` chính xác
- Có muốn dùng GLB provisional trong viewer thật (`?model=glb`) ngay bây giờ không?
- Ưu tiên sửa tiếp (vòng 2): sàn polygon chính xác, AO shader, hay labels trước?

---

## Cần mang về Claude Chat bàn

Xem HANDOVER.md mục cuối.

## CP-FALLBACK-HIDDEN-FIX (2026-10-26)

- Triệu chứng: sau khi bấm Bắt đầu, màn hình "Bản đồ 3D không hiển thị được" che bản đồ dù không có lỗi renderer.
- Xác minh trực tiếp trên trình duyệt tích hợp tại localhost:5173: trước sửa, #webgl-fallback có hidden=true nhưng computed display=flex. Bản đồ và giao diện phía sau đã khởi tạo.
- Sửa src/styles.css: thêm #webgl-fallback[hidden] vào quy tắc display:none !important hiện có. Không thay đổi điều kiện phát hiện lỗi WebGL.
- Kiểm chứng: sau sửa computed display=none; ảnh chụp xác nhận mô hình 3D hiển thị. Tải lại trang rồi bấm Bắt đầu vẫn hiện bản đồ. Mở ?force2d=1 vẫn hiện bản đồ SVG 2D và điều khiển tìm đường.
- Kiểm tra bằng trình duyệt tích hợp, chưa điều khiển trực tiếp Cốc Cốc. Người dùng tải lại localhost:5173 trên Cốc Cốc để nhận CSS mới.
- Không chạy lại build/pipeline trong phiên sửa CSS này. Không sửa GLB hoặc tích hợp beacon.
