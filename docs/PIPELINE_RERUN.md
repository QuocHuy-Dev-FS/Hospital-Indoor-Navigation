# Quy trình chạy lại pipeline khi có mặt bằng thật

**Áp dụng khi:** Đã nhận bản vẽ mặt bằng thật từ bệnh viện (xem `docs/FLOORPLAN_REQUEST.md`).  
**Không chạy khi** chỉ có sơ đồ mẫu (`sodobenhvienmau.jpg`) — dữ liệu ra sẽ không phản ánh thực tế.

---

## Điều kiện tiên quyết

- [ ] Có file ảnh mặt bằng thật (JPG/PNG ≥ 150 dpi, hoặc đã xuất JPG từ PDF/DWG)
- [ ] Biết tỉ lệ bản vẽ **hoặc** ít nhất 1 kích thước thực đo được (mét)
- [ ] Python venv đã cài: `tools/.venv/` tồn tại với `opencv-python`, `trimesh`, `pygltflib`
  - Nếu chưa có: `cd tools && python -m venv .venv && .venv\Scripts\activate && pip install -r floorplan/requirements.txt`
- [ ] Đang đứng ở thư mục gốc dự án khi chạy lệnh

---

## Bước 1 — Đặt ảnh vào thư mục đúng

```
assets/floorplans/F1_real.jpg    ← tầng trệt
assets/floorplans/F2_real.jpg    ← tầng 1
```

Đặt tên file theo mẫu `F<số>_real.<ext>` để phân biệt với sơ đồ mẫu (`sodobenhvienmau.jpg`).

---

## Bước 2 — Kích hoạt venv

```bash
# Windows
tools\.venv\Scripts\activate

# macOS / Linux
source tools/.venv/bin/activate
```

---

## Bước 3 — Chạy pipeline cho từng tầng

```bash
# Tầng trệt (F1)
python tools/floorplan/run_pipeline.py assets/floorplans/F1_real.jpg --floor F1

# Tầng 1 (F2) — sau khi F1 xong và đã đối chiếu
python tools/floorplan/run_pipeline.py assets/floorplans/F2_real.jpg --floor F2
```

**Đầu ra ghi vào:**
- `data/sample/F1/rooms.json`, `nodes.json`, `edges.json`, `connectors.json`, `geometry.json`, `review.json`
- `assets/models/sample/F1.glb`
- `assets/floorplans/_debug/F1_*.jpg` (overlay debug)

---

## Bước 4 — Xem review.json và điền thông số

```bash
# Mở file để đọc
python -I -c "import json; items=json.load(open('data/sample/F1/review.json')); [print(i['type'], '--', i.get('message','')) for i in items]"
```

Tất cả mục `need_confirm` phải được trả lời trước khi tiếp tục:

| Mục | Cần làm |
|-----|---------|
| `scale.confirmed` | Đo khoảng cách thực + số pixel tương ứng; điền `--ref-px` / `--ref-m` nếu pipeline hỗ trợ |
| `north_angle` | Xác nhận hướng Bắc và cập nhật `tools/floorplan/config.py` → `north_angle_deg` |
| `room_names` | Điền tên phòng thật vào `data/sample/F1/overrides.json`; chạy lại Bước 3 |
| `floor_number` | Xác nhận đây là Tầng trệt / Tầng 1 / ... |
| `floor_height_m` | Đo chiều cao trần thực tế, cập nhật config |

Sau khi điền overrides.json → chạy lại Bước 3 để regenerate.

---

## Bước 5 — Validate dữ liệu

```bash
node tools/validate_data.mjs
```

**Mục tiêu:** 0 lỗi. Cảnh báo orphan nodes là bình thường nếu vẫn còn nút thang máy/cầu thang chưa nối tầng.

---

## Bước 6 — Xuất SVG đối chiếu

```bash
python -I tools/gen_floor_svg.py
```

Mở `docs/survey/F1.svg` trong trình duyệt. Đối chiếu từng phòng với ảnh khảo sát thực địa và bản vẽ.

---

## Bước 7 — Gán roomId cho photo_findings

Mở `data/survey/photo_findings.json`. Với mỗi finding có `status = "chưa gán phòng"`:

1. Tìm phòng tương ứng trong SVG (dựa trên vị trí ảnh và tên phòng)
2. Ghi `roomId` đúng (ví dụ `F1_R003`)
3. Đổi `status` thành `"đã gán"`
4. Ghi lý do gán vào trường `ghiChu`

Hiện tại 6 findings chờ gán:

| ID | Hạng mục | Floor |
|----|----------|-------|
| FIND_001 | Quầy tiếp tân | F1 |
| FIND_002 | Kiosk/Điểm thông tin | F1 |
| FIND_003 | Cụm 3 cửa thang máy | F1 |
| FIND_004 | Khoa Dược | F2 |
| FIND_005 | Lan can kính / Giếng trời | F2 |
| FIND_006 | Biển LỐI THOÁT / EXIT | F2 |

---

## Bước 8 — Validate lại sau gán

```bash
node tools/validate_data.mjs
```

Phải vẫn 0 lỗi. Nếu có lỗi mới → điều tra trước khi tiếp tục.

---

## Lặp lại Bước 1–8 cho tầng tiếp theo

Xử lý F1 xong và được chủ dự án xác nhận → mới chạy F2, rồi F3.  
Không chạy nhiều tầng cùng lúc khi tầng trước chưa được đối chiếu thực địa.

---

## Câu hỏi mở — mang về Claude Chat trước khi tiếp tục

1. `overrides.json` mặc định (dòng 62–74 trong `run_pipeline.py`) dùng tên phòng sơ đồ mẫu — cần viết lại hoàn toàn với tên phòng thật sau khi có bản vẽ.
2. Tỉ lệ ảnh mặt bằng thật có thể khác sơ đồ mẫu → `px_per_m` sẽ thay đổi; cần xác nhận lại toàn bộ tọa độ beacon.
3. Nếu bản vẽ là PDF hoặc DWG: cần bước tiền xử lý (xuất ra JPG) trước khi đưa vào pipeline — hỏi Claude Chat về công cụ phù hợp.
4. Sau khi có F1 thật: dữ liệu `data/rooms.json` hiện tại (sinh từ `generate_data.mjs`, 9 tầng mẫu) sẽ bị thay thế hoàn toàn. **Không nên chạy `node tools/generate_data.mjs` nữa** — script đó chỉ dùng để tái sinh dữ liệu mẫu ban đầu.
