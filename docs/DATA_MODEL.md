# DATA_MODEL – Mô hình dữ liệu

> **Bản nháp, chốt ở Phase 3.** Mọi tọa độ theo hệ tọa độ thống nhất (mét) trong [FLOORPLAN_TO_3D.md](FLOORPLAN_TO_3D.md). Dữ liệu đặt trong `data/`.

## Quy ước ID
- Tòa nhà: `B1` · Tầng: `F1`, `F2`, `FB1` (hầm) · Phòng: `F1_R101` · Nút: `F1_N012` · Cạnh: `F1_E034` · Beacon: `F1_B01` · Thang máy: `ELEV_A` · Cầu thang: `STAIR_A`.
- ID **không đổi và không tái sử dụng**. Phòng bỏ → `status: "deprecated"`.

## Thực thể

### Building
`id, name, version, coordinateSystem{origin, northAngleDeg, unit:"m"}, floors[]`

### Floor
`id, buildingId, level (số nguyên), name, elevation_m, height_m (Cần xác nhận), modelFile ("assets/models/F1.glb")`

### Room (phòng/khoa/tiện ích)
```json
{
  "id": "F1_R101",
  "floorId": "F1",
  "name": "Phòng khám Nội 1",
  "nameAscii": "phong kham noi 1",
  "department": "Khoa Nội",
  "type": "clinic",
  "doorNodeId": "F1_N012",
  "centroid": {"x": 12.4, "z": 5.1},
  "aliases": ["P101"],
  "accessible": true,
  "status": "active",
  "beaconId": null
}
```
`beaconId` (tùy chọn, mặc định null): ID beacon gắn tại phòng này theo mô hình "một beacon mỗi phòng". Khi đã điền, phải khớp với `beacon.roomId` — xem ràng buộc validate bên dưới.
`type` ∈ clinic, lab, xray, cashier, pharmacy, wc, elevator, stairs, entrance, info, other (**Cần xác nhận** danh mục).

### Node (điểm nút đường đi)
`id, floorId, x, z, kind` với `kind` ∈ corridor, junction, door, room_entry, stair_end, elev_door, landing.

### Edge (cạnh)
```json
{
  "id": "F1_E034", "from": "F1_N011", "to": "F1_N012",
  "length_m": 6.2, "weight": 6.2, "bidirectional": true,
  "wheelchairOk": true, "type": "walk",
  "restricted": false, "widthMin_m": 1.4
}
```
`type` ∈ walk, stairs, elevator, ramp. `weight` mặc định = độ dài; có thể cộng phạt (đông, dốc).

### Connector (thang máy/cầu thang liên tầng)
`id, type (elevator|stairs|ramp), links[{floorId, nodeId}], wheelchairOk, restricted`. Cạnh liên tầng sinh từ connector; trọng số thang máy gồm thời gian chờ (**Cần xác nhận**).

### Beacon
```json
{
  "id": "F1_B01", "floorId": "F1", "x": 10.0, "z": 3.2, "height_m": 2.6,
  "protocol": "iBeacon", "uuid": "<…>", "major": 1, "minor": 1,
  "txPower_dBm": null, "rssiAt1m": null, "batteryPct": null,
  "installedAt": null, "status": "planned",
  "model": null,
  "sku": null,
  "mac": null,
  "firmware": null,
  "configInterface": null,
  "configMode": null,
  "roomId": null
}
```
`txPower`, `rssiAt1m`: **Cần xác nhận** bằng đo thực (xem HUONG_DAN.md). UUID/Major/Minor có thể coi là nhạy cảm → không công khai nếu không cần.

**Quy ước Major/Minor (chốt):**
- Một UUID chung cho toàn dự án (sinh bởi `tools/beacon_setup/new_project_uuid.ps1`).
- `major` = số tầng (1–9), ví dụ: tầng 1 → major 1, tầng 2 → major 2.
- `minor` = số thứ tự beacon trong tầng (bắt đầu từ 1), ví dụ: beacon thứ 3 trên tầng 1 → minor 3.
- ID beacon `F<tầng>_B<NN>` ánh xạ 1-1 với (major, minor): `F1_B03` → major=1, minor=3.
- `floorId` phải khớp với `F<major>`, ví dụ: major=1 → floorId=`"F1"`.
- Dùng `tools/beacon_setup/validate_beacons.py` để kiểm tra tính nhất quán trước khi đo.

Các trường mới (tất cả tùy chọn, mặc định null):
- `model`: tên bo in trên nhãn (ví dụ `"BLE Sensor Beacon V1.0"`).
- `sku`: mã SKU của hãng (ví dụ `"TEL0149"`) — **Cần xác nhận**.
- `mac`: địa chỉ MAC BLE — **có thể nhạy cảm, không đưa vào công khai nếu không cần**.
- `firmware`: phiên bản firmware đã Burn, nếu biết.
- `configInterface`: cổng cấu hình (`"uart"` | null).
- `configMode`: trạng thái cấu hình (`"ram"` = thử Run in RAM chưa Burn | `"burned"` = đã Burn vĩnh viễn | null = chưa cấu hình).
- `roomId`: ID phòng beacon này gắn tại (null khi chưa biết hoặc chưa lắp đặt).

### Zone (vùng)
`id, floorId, polygon[], kind` với `kind` ∈ `restricted` (cấm), `quiet`, `public`. Cạnh/nút trong vùng cấm bị loại khi tìm đường cho người ngoài.

### CalibrationRecord
`beaconId, distance_m, rssiMean, rssiStd, samples, date, condition`

## Ràng buộc kiểm tra (script validate – Phase 3)
- ID duy nhất; mọi tham chiếu (`doorNodeId`, `from/to`, `links`) tồn tại.
- Mỗi Room có `doorNodeId`; mỗi Beacon nằm trong đa giác sàn đúng tầng.
- Đồ thị liên thông (ngoại trừ vùng cấm đã khai báo); có đường xe lăn tới mọi phòng `accessible: true`.
- Cạnh `stairs` luôn `wheelchairOk: false`.
- Mô hình 3D có node trùng ID phòng.

**Ràng buộc validate DỰ KIẾN — chưa cài vào `tools/validate_data.mjs` (sẽ thêm ở Phase 3):**
- Nếu `beacon.roomId` có giá trị → room đó phải tồn tại và `room.beaconId` phải bằng `beacon.id` (khớp hai chiều).
- Nếu `room.beaconId` có giá trị → beacon đó phải tồn tại và `beacon.roomId` phải bằng `room.id`.
- Beacon có `status: "installed"` phải có `configMode: "burned"` (không được để "ram" hoặc null khi đã gắn thật).

**Câu hỏi mở về schema (chốt Phase 3):** Schema beacon/room hiện tại chưa có các trường trên; nếu mâu thuẫn với quyết định Phase 3 thì giữ quyết định Phase 3, bỏ ghi chú này.

## Phiên bản dữ liệu
`data/manifest.json`: `version`, `generatedAt`, `buildingId`, hash các file; app dùng để quyết định cập nhật (Phase 8).
