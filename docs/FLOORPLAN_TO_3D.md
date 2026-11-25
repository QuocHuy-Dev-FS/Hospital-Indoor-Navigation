# FLOORPLAN_TO_3D – Chuyển sơ đồ mặt bằng sang mô hình 3D

> **Hiện chưa có skill chuyên dụng cho việc này.** Quy trình dựa trên Python / Blender / Three.js. **Chỉ cài công cụ khi chủ dự án cho phép.** Các lệnh dưới đây là mẫu, chưa được chạy thử trong dự án này; kiểm tra phiên bản và tham số khi áp dụng.

## 0. Quy ước chung (áp dụng mọi phương án)

- **Đơn vị:** mét. **Trục:** X sang phải, Y lên (chiều cao), Z hướng về người xem (chuẩn glTF/Three.js). Bản đồ 2D: (x, z) mặt phẳng sàn. **Cần xác nhận** gốc tọa độ (đề xuất: một góc cố định của tòa nhà, dùng chung mọi tầng).
- **Chiều cao tầng:** **Cần xác nhận** (đo thực tế). Mỗi tầng đặt ở `y = chỉ số_tầng × chiều_cao_tầng`, hoặc mỗi tầng một file GLB cùng gốc XZ.
- **Tên node:** `F<tầng>_R<số>` cho phòng (ví dụ `F1_R101`); `F1_WALL_xxx`, `F1_DOOR_xxx`, `F1_FLOOR`, `F1_STAIR_xx`, `F1_ELEV_xx`. Trùng với ID trong `data/` ([DATA_MODEL.md](DATA_MODEL.md)).
- Lưu sơ đồ gốc bất biến trong `assets/floorplans/` (kèm ngày); sản phẩm trung gian đặt ở thư mục riêng, không ghi đè.

## 1. Đầu vào: ảnh / PDF mặt bằng

1. **Rasterize PDF (nếu cần):**
   ```bash
   pdftoppm -r 300 -png floor1.pdf floor1     # poppler-utils
   ```
2. **Đo tỉ lệ:** chọn 2 điểm có khoảng cách thật đã biết (ví dụ chiều dài hành lang đo bằng thước laser). Tính `mét_trên_pixel = khoảng_thật / khoảng_pixel`. Dùng ≥2 cặp điểm để kiểm tra; chênh lệch lớn → sơ đồ méo, **Cần xác nhận** với chủ dự án.
3. **Vector hóa – phương án 1 (Inkscape/potrace):** nhị phân hóa ảnh rồi trace.
   ```bash
   convert floor1.png -threshold 55% floor1.pbm   # ImageMagick
   potrace floor1.pbm -s -o floor1.svg
   ```
4. **Vector hóa – phương án 2 (OpenCV, trích đường tường):**
   ```python
   import cv2, numpy as np
   img = cv2.imread("floor1.png", cv2.IMREAD_GRAYSCALE)
   _, bw = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
   # (tùy chọn) loại chữ/ký hiệu nhỏ
   bw = cv2.morphologyEx(bw, cv2.MORPH_OPEN, np.ones((3,3), np.uint8))
   lines = cv2.HoughLinesP(bw, 1, np.pi/180, threshold=80, minLineLength=40, maxLineGap=8)
   M_PER_PX = 0.0123  # thay bằng giá trị đã đo ở bước 2
   segs = [((x1*M_PER_PX, y1*M_PER_PX), (x2*M_PER_PX, y2*M_PER_PX)) for x1,y1,x2,y2 in lines[:,0]]
   ```
5. **Làm sạch:** gộp đoạn gần thẳng hàng, nối điểm gần nhau (dung sai **Cần xác nhận**, ví dụ 5 cm), xóa nét nhiễu. Kiểm tra bằng mắt trên lớp phủ lên ảnh gốc.
6. **Xuất trung gian:** `walls.json` (danh sách đoạn tường + độ dày), `rooms.json` (đa giác phòng + ID), `doors.json` (vị trí + độ rộng).
   Tự động hóa chỉ là bán tự động: **luôn rà soát thủ công**, đặc biệt cửa và cầu thang.

## 2. Đầu vào: DWG / DXF

- **DWG** → chuyển sang DXF bằng công cụ có giấy phép phù hợp (ví dụ ODA File Converter hoặc AutoCAD). **Cần xác nhận** giấy phép/công cụ.
- **Đọc DXF bằng ezdxf:**
  ```python
  import ezdxf
  doc = ezdxf.readfile("floor1.dxf")
  print(doc.header.get("$INSUNITS"))      # đơn vị bản vẽ (4=mm, 5=cm, 6=m)
  msp = doc.modelspace()
  for e in msp.query("LINE LWPOLYLINE"):
      if e.dxf.layer.upper() in ("WALL", "TUONG"):   # tên layer: Cần xác nhận
          ...
  ```
- Liệt kê layer trước (`doc.layers`) để xác định layer tường/cửa/phòng. Quy đổi về mét theo `$INSUNITS`.
- **Phương án thay thế:** xuất DXF → SVG (Inkscape: `inkscape floor1.dxf --export-type=svg`), rồi xử lý như mục 1.

## 3. Dựng 3D

### Phương án A – Python/Blender (`bpy`), chạy nền
Phù hợp: tự động hóa nhiều tầng.
```bash
blender --background --python tools/build_floor.py -- walls.json rooms.json doors.json out/F1.glb
```
Ý chính của script mẫu:
```python
import bpy, bmesh, json, sys
WALL_H, WALL_T = 3.0, 0.2     # chiều cao/độ dày: Cần xác nhận
def extrude_wall(p1, p2, name):
    ...  # tạo hộp từ đoạn p1-p2, độ dày WALL_T, cao WALL_H; đặt tên node = name
# 1) đọc JSON  2) tạo sàn từ đa giác phòng (bmesh.ops.contextual_create)
# 3) đùn tường  4) cắt cửa bằng Boolean modifier (hoặc chừa khe khi tạo tường)
# 5) đặt tên object = ID phòng/tường/cửa  6) bpy.ops.export_scene.gltf(filepath=..., export_format='GLB')
```
Lưu ý: Blender dùng Z lên; exporter glTF chuyển sang Y lên (`export_yup=True`, mặc định). **Kiểm tra** hướng trục sau khi xuất.

### Phương án B – Three.js sinh hình học từ JSON (không cần Blender)
Phù hợp: dữ liệu thay đổi thường xuyên, cập nhật không cần build lại mô hình.
```js
// walls.json -> BoxGeometry/ExtrudeGeometry tại runtime
import * as THREE from "three";
function buildWalls(walls, h = 3.0, t = 0.2) {
  const g = new THREE.Group();
  for (const w of walls) {
    const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, h, t), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
    mesh.position.set((w.x1 + w.x2) / 2, h / 2, (w.z1 + w.z2) / 2);
    mesh.rotation.y = -Math.atan2(w.z2 - w.z1, w.x2 - w.x1);
    mesh.name = w.id;
    g.add(mesh);
  }
  return g;
}
```
Ưu: nhẹ, dễ cập nhật. Nhược: ít chi tiết, cửa sổ/cửa cần xử lý riêng. (Dependency `three` chỉ cài khi được phép.)

### Phương án C – Dựng tay trong Blender
Dùng cho khu vực phức tạp (sảnh, cầu thang xoắn, mái). Import phần tự động (GLB) rồi chỉnh tay; **giữ nguyên tên node**; ghi lại thay đổi thủ công trong `PROJECT_STATUS.md`.

## 4. Xuất, tối ưu GLB

```bash
npx @gltf-transform/cli inspect out/F1.glb
npx @gltf-transform/cli optimize out/F1.glb assets/models/F1.glb --compress draco
```
(`@gltf-transform/cli` chạy qua `npx`, **cần cho phép cài**; các cờ có thể thay đổi theo phiên bản — xem `--help`.)
- Gộp vật liệu, giảm số mesh, giữ node phòng để chọn/highlight.
- Mục tiêu dung lượng/FPS: **Cần xác nhận** theo thiết bị yếu nhất (Phase 0).
- Draco/meshopt cần decoder phía viewer; kiểm tra tương thích.

## 5. Hệ tọa độ thống nhất với định vị
- Tọa độ beacon, nút đồ thị và GLB cùng gốc/đơn vị/trục (mục 0).
- Giữ file `data/coordinate_system.json` (gốc, hướng Bắc, chiều cao tầng) làm nguồn sự thật duy nhất.
- Script kiểm tra: mọi nút nằm trong đa giác sàn; mọi beacon nằm trong tầng đúng.

## 6. Checklist kiểm tra chất lượng
- [ ] Tỉ lệ: ≥3 kích thước thực đo so với mô hình, sai lệch trong ngưỡng **Cần xác nhận**
- [ ] Mọi phòng trong danh sách có node `F<n>_R<xxx>` duy nhất
- [ ] Không tường chồng lấn/lỗ hổng; cửa nằm đúng vị trí và đủ rộng cho xe lăn (**Cần xác nhận** ngưỡng)
- [ ] Hướng pháp tuyến đúng (không mặt bị lật)
- [ ] Các tầng thẳng hàng (cầu thang/thang máy trùng tọa độ XZ)
- [ ] GLB mở được trên viewer của dự án và công cụ ngoài (ví dụ gltf viewer); dung lượng đạt
- [ ] Đối chiếu trực quan với sơ đồ gốc (chồng lớp)
- [ ] Chủ dự án/nhân viên đối chiếu tại hiện trường

## 7. Cập nhật khi bệnh viện sửa chữa
1. Lưu sơ đồ mới (không ghi đè bản cũ), so sánh phát hiện thay đổi.
2. Sửa `walls/rooms/doors.json` (hoặc DXF) chỉ ở khu vực đổi.
3. Dựng lại **chỉ tầng bị ảnh hưởng**; giữ nguyên ID phòng không đổi; phòng mới → ID mới, phòng bỏ → đánh dấu `deprecated`, không tái sử dụng ID.
4. Cập nhật nút/cạnh đồ thị và beacon bị ảnh hưởng; đo lại RSSI khu vực.
5. Chạy checklist mục 6 và script validate dữ liệu.
6. Phát hành bản đồ mới có version (Phase 8); ghi `CHANGELOG`, `PROJECT_STATUS.md`.
