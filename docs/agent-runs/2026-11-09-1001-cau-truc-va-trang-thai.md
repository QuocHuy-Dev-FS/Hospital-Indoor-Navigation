# Báo cáo: Cấu trúc dự án và tóm tắt trạng thái (2026-11-09)

Loại: CHỈ-ĐỌC, rủi ro thấp. Không sửa mã, không chạy test/build.

## Trạng thái chung
- Nhánh `master`, **chưa có commit nào**; toàn bộ file đang untracked. (Nhánh chính ghi nhận: `main`.)
- Phase dự án: **Chuẩn bị (khung tài liệu hoàn tất) → chờ Phase 0** (ROADMAP.md). Chưa chuyển phase.
- Phase 0 còn mở: sơ đồ mặt bằng, danh sách phòng, thiết bị, bench RSSI, chính sách Burn (4f), quy định bệnh viện, ngân sách.

## Cấu trúc thư mục
| Thư mục / file | Nội dung |
|---|---|
| `CLAUDE.md`, `ROADMAP.md`, `PROJECT_STATUS.md`, `HANDOVER.md`, `README.md`, `HUONG_DAN.md`, `PRODUCT.md`, `DESIGN.md` | Quy tắc, kế hoạch, trạng thái, bàn giao |
| `.claude/` | `agents/` (hin-planner/executor/verifier), `commands/` (hin, doi, analyst, prompt-architect, reporter, researcher, reviewer), `skills/`, `launch.json`, `worktrees/` |
| `src/` | `main.js`, `scene/` (3D), `map2d/`, `nav/` (astar, instructions, route_summary), `positioning/` (ble_adapter, beacon_sim, bridge_source, geofence, position_provider, load_beacon_map), `search/`, `ui/` (mapFlow, floorScope, CSS), `quality/`, `beacon-admin/` |
| `data/` | nodes, edges, rooms, floors, connectors, beacons, beacon-map, coordinate_system, geofence, manifest, photo-nodes, `schema/`, `survey/` |
| `assets/` | `floorplans/`, `models/` (GLB tạm F1), `hardware/` (tài liệu TEL0149) |
| `tools/` | `floorplan/` (pipeline Python), `beacon_bridge/`, `beacon_setup/`, `generate_data.mjs`, `dev-lan.mjs`, `.venv` |
| `tests/` | 10 file `.test.mjs` |
| `bench/` | công cụ bench RSSI |
| `docs/` | ARCHITECTURE, DATA_MODEL, FLOORPLAN_TO_3D, HARDWARE, PRIVACY_SECURITY, WORKFLOW, ..., `prompts/` (2), `agent-runs/` |
| `index.html`, `beacon-admin.html`, `scan/` | Các trang web (app chính, admin, quét) |
| `public/brand/`, `dist/`, `node_modules/` | Thương hiệu, bản build, dependency |

Có nhiều file sao lưu `*.bak-*` ở thư mục gốc và `src/`.

## Checkpoint gần nhất (theo PROJECT_STATUS.md, chưa chạy lại)
1. **CP-BEACON-MAP-PLAN (2026-11-02)** – Một phần: đã khảo sát và lập Plan A/B hiện beacon trên bản đồ 3D; **chờ duyệt Cổng 1**. Q30–Q35 ghi vào ROADMAP.
2. **CP-UI-MOBILE-FLOW (2026-11-02)** – Hoàn thành (bản thử nghiệm): luồng di động S0–S3. Ghi nhận verifier: `npm test` 124/124, build OK, validate 0 lỗi/1 cảnh báo. Chưa chạy trên điện thoại thật.
3. **CP-tool.2 / CP-tool.1** – Lệnh `/hin` và 3 subagent đã tạo; chưa chạy thử đầy đủ lần đầu.

## Việc còn lại / câu hỏi mở
- Duyệt Plan A (beacon trên bản đồ); trả lời Q30–Q34.
- HTTPS cho điện thoại khi dev; tọa độ geofence; app native cho iPhone; ngưỡng confidence/stale/GPS cần đo; dữ liệu chưa có trường "khoa"; `ble_adapter` chưa trả confidence.
- Dữ liệu beacon: F1_B01 chưa gắn phòng; tọa độ có thể là tạm.
- Cần xác nhận: `/data/*.json` có được phục vụ trong bản build không.
