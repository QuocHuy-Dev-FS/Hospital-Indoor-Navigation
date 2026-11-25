# README – build_floor.py

Pipeline chuyển ảnh sơ đồ mặt bằng → file trung gian JSON + mô hình 3D GLB + 6 ảnh render.

> **BẢN TẠM** – Kết quả cần xác nhận tỉ lệ và vị trí phòng tại hiện trường trước khi dùng chính thức.

---

## Yêu cầu

- Python (thử với `py --version` hoặc `python --version`)
- Môi trường ảo tại `tools/.venv` với các gói: `numpy`, `opencv-python-headless`, `shapely`, `trimesh`, `pillow`, `scipy`

Tạo venv (chỉ làm một lần, sau khi được chủ dự án cho phép):

```bash
py -m venv tools/.venv
tools/.venv/Scripts/pip install numpy opencv-python-headless shapely trimesh pillow scipy
```

---

## Chạy cơ bản

```bash
# Từ thư mục gốc dự án
tools/.venv/Scripts/python.exe tools/build_floor.py --image assets/floorplans/sodobenhvienmau.jpg
```

---

## Tham số

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `--image PATH` | `assets/floorplans/sodobenhvienmau.jpg` | Đường dẫn ảnh sơ đồ |
| `--scale-m-per-px X` | tự tính từ baseline | Tỉ lệ mét/pixel đã biết |
| `--ref-px X` + `--ref-m Y` | — | Cặp điểm tham chiếu: X pixel tương đương Y mét |
| `--paths-are-walls` | False | Coi đường xanh là tường (không khuyến nghị) |
| `--out DIR` | `tools/out` | Thư mục đầu ra trung gian |

Ví dụ với tỉ lệ đã đo thực tế:

```bash
tools/.venv/Scripts/python.exe tools/build_floor.py \
  --image assets/floorplans/sodobenhvienmau.jpg \
  --ref-px 1250 --ref-m 20.5
```

---

## Đầu ra

| File | Vị trí | Mô tả |
|---|---|---|
| `F1_paths_mask.png` | `tools/out/` | Mặt nạ đường dẫn xanh (trắng = xanh) |
| `F1_walls_mask.png` | `tools/out/` | Mặt nạ tường (trắng = tường) |
| `walls.json` | `tools/out/` | Danh sách đoạn tường (BẢN NHÁP) |
| `doors.json` | `tools/out/` | Danh sách cửa phát hiện được (BẢN NHÁP) |
| `paths_draft.json` | `tools/out/` | Skeleton hành lang (BẢN NHÁP) |
| `rooms_draft.json` | `tools/out/` | Danh sách phòng + bbox (BẢN NHÁP) |
| `coordinate_system_F1_provisional.json` | `data/` | Thông số tỉ lệ (TẠM) |
| `F1_dollhouse_provisional.glb` | `assets/models/` | Mô hình 3D dollhouse (1.2m cao) |
| `F1_full_provisional.glb` | `assets/models/` | Mô hình 3D toàn chiều (3.0m cao) |
| `F1_iso_dollhouse_NE.png` | `tools/out/` | Render isometric nhìn từ NE |
| `F1_iso_dollhouse_NW.png` | `tools/out/` | Render isometric nhìn từ NW |
| `F1_iso_dollhouse_SE.png` | `tools/out/` | Render isometric nhìn từ SE |
| `F1_iso_full.png` | `tools/out/` | Render isometric tầng đầy đủ |
| `F1_topdown.png` | `tools/out/` | Render nhìn từ trên xuống |
| `F1_overlay.png` | `tools/out/` | Overlay phòng + tường lên ảnh gốc |

> File GLB có timestamp nếu file cũ tồn tại (`F1_dollhouse_provisional_HHMMSS.glb`).

---

## Xem GLB trong trình duyệt

Sau khi chạy `npm run dev`:

```
http://localhost:5173/?model=glb
```

Mặc định load `F1_dollhouse_provisional.glb`. Để load file khác:

```
http://localhost:5173/?model=glb&glb=/assets/models/F1_full_provisional.glb
```

---

## Kiểm tra WebGL

Mở `tools/webgl_check.html` bằng cách click đôi trong File Explorer (không cần server).

---

## Lưu ý quan trọng

- Kết quả là **BẢN TẠM** — cần xác nhận tỉ lệ bằng đo thực tế tại hiện trường
- Vị trí seed phòng (`KNOWN_ROOMS` trong script) được ước lượng từ ảnh gốc 1750×2100 và rescale; cần rà soát thủ công
- Không ghi đè `data/coordinate_system.json` và `data/nodes.json`, `data/edges.json`
- Không commit file GLB lên repo khi chưa được cho phép
- Hướng Bắc chưa được xác nhận — la bàn trong render hiển thị "N?" (Cần xác nhận)
