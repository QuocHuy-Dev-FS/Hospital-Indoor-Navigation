---
name: floorplan-to-glb
description: Quy trình chuyển sơ đồ mặt bằng (ảnh/PDF/DXF) thành mô hình 3D GLB tối ưu cho dự án Hospital Indoor Navigation. Bám docs/FLOORPLAN_TO_3D.md và quy ước ID phòng F<tầng>_R<số>.
---

# Skill: floorplan-to-glb

> **CÁC LỆNH TRONG SKILL NÀY CHƯA ĐƯỢC CHẠY THỬ TRONG DỰ ÁN.**
> Kiểm tra phiên bản, tham số và sự tồn tại của công cụ trước khi thực thi.
> Chỉ cài công cụ sau khi được chủ dự án cho phép rõ ràng.
> Script mẫu KHÔNG tự cài package, KHÔNG tải mã từ mạng.

## Mục tiêu
Chuyển sơ đồ mặt bằng (ảnh raster, PDF, DXF/DWG) thành file GLB đúng tỉ lệ, tối ưu, với node đặt tên theo ID phòng. Kết quả đặt tại `assets/models/F<n>.glb`.

---

## Quy ước bắt buộc (từ docs/FLOORPLAN_TO_3D.md và docs/DATA_MODEL.md)

- **Đơn vị:** mét. **Trục:** X sang phải, Y lên, Z hướng về người xem (chuẩn glTF/Three.js).
- **Tên node:**
  - Phòng: `F<tầng>_R<số>` (ví dụ `F1_R101`)
  - Tường: `F1_WALL_xxx` · Cửa: `F1_DOOR_xxx` · Sàn: `F1_FLOOR`
  - Cầu thang: `F1_STAIR_xx` · Thang máy: `F1_ELEV_xx`
- **Gốc tọa độ:** **Cần xác nhận** – một góc cố định của tòa nhà, dùng chung mọi tầng; lưu vào `data/coordinate_system.json`.
- **Chiều cao tầng / tường:** **Cần xác nhận** – đo thực tế tại hiện trường.
- **Lưu sơ đồ gốc** bất biến trong `assets/floorplans/<tên>_<ngày>.<ext>`; **KHÔNG ghi đè** bản cũ.
- **Sản phẩm trung gian** (`walls.json`, `rooms.json`, `doors.json`, `scale_params.json`) đặt trong `tools/build_output/`; không ghi đè nếu chưa backup.

---

## Bước 1: Phân loại và kiểm tra đầu vào

1. Xác định định dạng: ảnh raster (PNG/JPG), PDF, DXF, DWG.
2. Kiểm tra tỉ lệ/độ phân giải đã ghi trong sơ đồ; nếu không có → ghi "Cần xác nhận" và đo thực tế.
3. DWG → phải chuyển sang DXF bằng công cụ có giấy phép phù hợp (ODA File Converter hoặc AutoCAD); **Cần xác nhận** công cụ và giấy phép trước khi tiến hành.
4. Ghi nguồn, ngày, định dạng sơ đồ vào `PROJECT_STATUS.md`.

---

## Bước 2: Chuẩn bị (PDF → ảnh)

```bash
# Cần poppler-utils – chỉ cài khi được chủ dự án cho phép
pdftoppm -r 300 -png assets/floorplans/floor1.pdf assets/floorplans/floor1
```

---

## Bước 3: Đo tỉ lệ (bắt buộc trước khi vector hóa)

1. Chọn ≥2 cặp điểm có khoảng cách thực đã biết (thước laser đo tại hiện trường).
2. Tính `M_PER_PX = khoảng_thực_m / khoảng_pixel`.
3. So sánh các cặp điểm; chênh lệch >5% → báo cáo "Cần xác nhận – sơ đồ có thể méo".
4. Lưu `tools/build_output/scale_params.json`:
   ```json
   { "floorId": "F1", "M_PER_PX": null, "measuredPairs": [], "checkedBy": null, "date": null }
   ```

---

## Bước 4: Vector hóa (ảnh/PDF)

```bash
# Phương án 1: Inkscape/potrace – chỉ cài khi được phép
convert assets/floorplans/floor1.png -threshold 55% tools/build_output/floor1.pbm
potrace tools/build_output/floor1.pbm -s -o tools/build_output/floor1.svg
```

```python
# Phương án 2: OpenCV – chỉ chạy khi opencv-python đã được cài và được phép
# Đặt tại tools/vectorize_floor.py – KHÔNG tự cài package
import cv2, numpy as np, json

img = cv2.imread("assets/floorplans/floor1.png", cv2.IMREAD_GRAYSCALE)
_, bw = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
bw = cv2.morphologyEx(bw, cv2.MORPH_OPEN, np.ones((3,3), np.uint8))
lines = cv2.HoughLinesP(bw, 1, np.pi/180, threshold=80, minLineLength=40, maxLineGap=8)

M_PER_PX = None  # điền từ scale_params.json – Cần xác nhận
if lines is not None and M_PER_PX:
    segs = [{"x1": x1*M_PER_PX, "z1": y1*M_PER_PX,
              "x2": x2*M_PER_PX, "z2": y2*M_PER_PX}
            for x1,y1,x2,y2 in lines[:,0]]
    json.dump(segs, open("tools/build_output/walls_raw.json","w"), indent=2)
```

**Lưu ý:** Tự động hóa chỉ là bán tự động. Luôn rà soát thủ công kết quả, đặc biệt cửa và cầu thang.

---

## Bước 5: Xử lý DXF

```python
# Chỉ chạy khi ezdxf đã được cài và được phép
# Đặt tại tools/read_dxf.py – KHÔNG tự cài package
import ezdxf, json

doc = ezdxf.readfile("assets/floorplans/floor1.dxf")
print("INSUNITS:", doc.header.get("$INSUNITS"))  # 4=mm, 5=cm, 6=m
# Liệt kê layer trước để xác nhận tên layer tường/cửa/phòng (Cần xác nhận)
for layer in doc.layers:
    print(layer.dxf.name)

WALL_LAYERS = ["WALL", "TUONG"]  # Cần xác nhận với chủ dự án
msp = doc.modelspace()
walls = []
for e in msp.query("LINE LWPOLYLINE"):
    if e.dxf.layer.upper() in WALL_LAYERS:
        pass  # trích tọa độ, quy đổi về mét theo INSUNITS
json.dump(walls, open("tools/build_output/walls_dxf.json","w"), indent=2)
```

---

## Bước 6: Dựng 3D (chọn một phương án)

### Phương án A – Blender (bpy), chạy nền
```bash
# Cần Blender đã cài trong PATH – chỉ cài khi được phép
blender --background --python tools/build_floor.py -- \
  tools/build_output/walls.json \
  tools/build_output/rooms.json \
  tools/build_output/doors.json \
  tools/build_output/F1_raw.glb
```

Tham số mặc định trong script (đều **Cần xác nhận**):
- `WALL_H = 3.0`  (chiều cao tường, mét)
- `WALL_T = 0.2`  (độ dày tường, mét)

> Blender dùng Z lên; glTF exporter chuyển sang Y lên (`export_yup=True`, mặc định).
> **Kiểm tra hướng trục sau khi xuất** trước khi đưa vào viewer.

### Phương án B – Three.js sinh hình học runtime
Xem mẫu đầy đủ tại `docs/FLOORPLAN_TO_3D.md` mục 3B. Phù hợp khi dữ liệu thay đổi thường xuyên; không cần Blender; dependency `three` chỉ cài khi được phép.

### Phương án C – Dựng tay trong Blender
Dùng cho khu phức tạp (sảnh, cầu thang xoắn). Import phần tự động rồi chỉnh tay; **giữ nguyên tên node**; ghi mọi thay đổi thủ công vào `PROJECT_STATUS.md`.

---

## Bước 7: Xuất và tối ưu GLB

```bash
# Cần @gltf-transform/cli qua npx – chỉ cài khi được phép
npx @gltf-transform/cli inspect tools/build_output/F1_raw.glb
npx @gltf-transform/cli optimize tools/build_output/F1_raw.glb assets/models/F1.glb --compress draco
```

- Draco cần decoder phía viewer; kiểm tra tương thích với nền tảng (Phase 1).
- Mục tiêu dung lượng/FPS: **Cần xác nhận** (Phase 0 – thiết bị yếu nhất).

---

## Bước 8: Checklist chất lượng (từ docs/FLOORPLAN_TO_3D.md mục 6)

- [ ] ≥3 kích thước thực đo so với mô hình, sai lệch trong ngưỡng **Cần xác nhận**
- [ ] Mọi phòng trong danh sách có node `F<n>_R<xxx>` duy nhất
- [ ] Không tường chồng lấn/lỗ hổng; cửa đúng vị trí và đủ rộng cho xe lăn (**Cần xác nhận** ngưỡng)
- [ ] Hướng pháp tuyến đúng (không mặt bị lật)
- [ ] Các tầng thẳng hàng (cầu thang/thang máy trùng tọa độ XZ)
- [ ] GLB mở được trên viewer của dự án và gltf-viewer ngoài
- [ ] Đối chiếu trực quan với sơ đồ gốc (chồng lớp)
- [ ] Chủ dự án/nhân viên đối chiếu tại hiện trường

---

## Báo cáo sau khi hoàn thành

Ghi vào `PROJECT_STATUS.md` với checkpoint `CP2.x`:
- File đầu vào, công cụ đã dùng, phiên bản
- Kết quả kiểm tra chất lượng (từng mục checklist)
- Sai lệch tỉ lệ đo được
- Mục "Cần xác nhận" còn lại → mang về Claude Chat
