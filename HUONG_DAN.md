# HƯỚNG DẪN VẬN HÀNH (cho người không chuyên)

> Trạng thái: **hướng dẫn quy trình**. Phần phần mềm (app, admin) chưa tồn tại; các bước liên quan ghi "sẽ có ở Phase X". Mọi con số ghi "Cần xác nhận" phải được đo/xác nhận tại hiện trường.

## 1. Lắp đặt và đặt beacon

**Chuẩn bị:** danh sách beacon (mã MAC/UUID–Major–Minor), bản in sơ đồ từng tầng, thang đo/thước laser, băng dính hai mặt hoặc giá treo, điện thoại có app quét BLE (ví dụ nRF Connect).

1. Đánh số mỗi beacon bằng nhãn dán (ví dụ `F1-B01`) và ghi vào bảng theo dõi (mã nhãn ↔ UUID/Major/Minor ↔ vị trí).
2. Đánh dấu vị trí dự kiến trên sơ đồ: ưu tiên **ngã rẽ, cửa vào khoa, sảnh, chân/đỉnh cầu thang và thang máy**, rồi đến hành lang dài.
3. Khoảng cách giữa các beacon: **Cần xác nhận** (phụ thuộc kết quả khảo sát Phase 0 và công suất phát).
4. Gắn beacon cao cố định (ví dụ gần trần, **Cần xác nhận** độ cao), cách xa kim loại lớn, thiết bị y tế và nguồn nhiễu. Không gắn trong tủ kim loại.
5. Ghi lại **tọa độ thực** (tầng, x, y, độ cao) của từng beacon vào `data/` (xem [docs/DATA_MODEL.md](docs/DATA_MODEL.md)). Xin phép bệnh viện trước khi gắn ở khu vực hạn chế.
6. Chụp ảnh vị trí đã gắn để sau này kiểm tra/thay pin.

## 2. Đo và hiệu chỉnh tín hiệu

> **Từ CP-BEACON-BRIDGE trở đi:** Dùng trang **Quản trị Beacon** (`/beacon-admin.html`)
> thay cho app quét thủ công. Các bước bên dưới mô tả quy trình kết hợp.

**Chuẩn bị (một lần):**

**B1.** Nếu chưa có UUID dự án, tạo `data/beacons.local.json` từ template:
   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\beacon_setup\new_project_uuid.ps1
   ```
   Sau đó mở file, điền Major/Minor/x/z thật cho từng beacon (UUID đã được sinh tự động).

1. Điền UUID/Major/Minor thật của beacon vào `data/beacons.local.json`
   (xem mẫu `data/beacons.local.example.json`; hoặc đã có từ bước B1 trên).
2. Điền beacon key vào `tools/beacon_bridge/allowlist.json`
   (xem mẫu `allowlist.json.example`; **hoặc** bỏ qua bước này nếu dùng `--beacons` ở bước 1 đo RSSI).
3. Cài gói Python bridge (một lần):
   ```
   cd tools/beacon_bridge
   .venv/Scripts/activate
   pip install -r requirements.txt
   ```

**Đo RSSI:**

**D1.** Kiểm tra file beacon hợp lệ trước khi đo:
   ```bash
   python tools/beacon_setup/validate_beacons.py
   ```
   Sửa mọi lỗi báo ra trước khi tiếp tục. Thêm `--file <path>` để chỉ định file khác.

1. Chạy cầu nối:
   ```bash
   # Tùy chọn A — dùng allowlist.json (cũ):
   python tools/beacon_bridge/bridge.py
   # Tùy chọn B — tự lấy allowlist từ beacons.local.json (mới, không cần điền allowlist.json):
   python tools/beacon_bridge/bridge.py --beacons data/beacons.local.json
   ```
2. Mở `http://localhost:5173/beacon-admin.html` trên laptop.
3. Đứng cách beacon đúng khoảng cách cần đo (ví dụ 1 m), giữ laptop ổn định.
4. Trong mục **Ghi CalibrationRecord**: chọn beacon, nhập khoảng cách và điều kiện.
5. Nhấn **Bắt đầu đo** — trang tự thu 30 mẫu RSSI (~6 giây).
6. Nhấn **Xuất bản ghi** → lưu file `.json` vào `bench/measurements/`.
7. Lặp lại ở các khoảng cách 0.5 m, 1 m, 2 m, 4 m, 8 m × 2 điều kiện (trống, đông người).

**Sau khi có số liệu:**

```bash
node tools/suggest-thresholds.mjs bench/measurements/<file>.csv
```

Kết quả in ra ngưỡng RSSI đề xuất — cập nhật `DEFAULT_PARAMS` trong
`bench/room-resolver.js`. (Mang file đo về Claude Chat để phân tích.)

**F3.** Tổng hợp thống kê đầy đủ và hồi quy path-loss:
```bash
python tools/beacon_setup/summarize_calibration.py bench/measurements/<file>.csv
```
Kết quả in ra: n mẫu, RSSI trung bình/trung vị/σ mỗi khoảng cách (sau lọc IQR),
hồi quy RSSI = A − 10·n·log10(d) với A, n, R², cùng đề xuất `rssiAt1m` cho beacon.
Thêm `--condition "Hành lang trống"` để lọc theo điều kiện đo cụ thể.

Sai số cho phép của hệ thống: **Cần xác nhận** (đề xuất ban đầu ≤ 3 m / đúng phòng).

## 3. Thêm phòng/khoa vào dữ liệu

1. Xác định: tầng, mã phòng (quy ước `F<tầng>_R<số>`, ví dụ `F1_R101`), tên hiển thị tiếng Việt, khoa, loại phòng.
2. Xác định **điểm cửa** (nơi người đi vào) và nút đường đi gần nhất.
3. Thêm bản ghi vào tệp dữ liệu phòng theo mẫu trong [docs/DATA_MODEL.md](docs/DATA_MODEL.md).
4. Nếu phòng là hình khối mới, cập nhật mô hình 3D theo [docs/FLOORPLAN_TO_3D.md](docs/FLOORPLAN_TO_3D.md) và đặt tên node trùng mã phòng.
5. Chạy kiểm tra dữ liệu (script kiểm tra sẽ có ở Phase 3) và xem lại trên viewer (Phase 4).

## 4. Cập nhật bản đồ khi bệnh viện thay đổi

1. Lưu sơ đồ mới vào `assets/floorplans/` kèm ngày (ví dụ `F1_2026-11-01.pdf`), **không ghi đè** bản cũ.
2. So sánh với bản cũ, liệt kê phòng/tường/cửa thay đổi.
3. Cập nhật mô hình 3D và dữ liệu phòng, nút, cạnh (theo mục "Cập nhật khi bệnh viện sửa chữa" trong FLOORPLAN_TO_3D.md).
4. Nếu beacon bị dời/thêm: cập nhật tọa độ và đo lại hiệu chỉnh khu vực đó.
5. Kiểm tra lại các tuyến đường đi qua khu vực thay đổi.
6. Ghi vào `CHANGELOG` (sẽ tạo khi có thay đổi đầu tiên) và `PROJECT_STATUS.md`.

## 5. Kiểm thử tại hiện trường

1. In kịch bản kiểm thử (Phase 9): danh sách điểm xuất phát – điểm đến, gồm cả tuyến đa tầng và tuyến xe lăn.
2. Với mỗi tuyến: đứng đúng điểm xuất phát, mở app, ghi vị trí app báo so với vị trí thật; đi theo chỉ dẫn, ghi chỗ sai/lạc.
3. Đo sai số vị trí (m) tại các điểm mốc; ghi đúng/sai phòng.
4. Thử vào giờ cao điểm và giờ vắng.
5. Nhờ vài người dùng thật (người cao tuổi, người chưa dùng app) thử và ghi phản hồi.
6. Tổng hợp kết quả vào báo cáo và mang về Claude Chat để lập kế hoạch hiệu chỉnh.

## 6. Khi gặp sự cố

| Hiện tượng | Kiểm tra trước |
|---|---|
| App báo sai tầng/phòng | Beacon gần đó còn pin? Có bị dời? Đo lại RSSI khu vực |
| Không thấy beacon | Bluetooth + quyền vị trí trên điện thoại đã bật? |
| Đường đi vô lý | Dữ liệu nút/cạnh khu vực đó có đúng? |

---

## 7. Bench test beacon đầu tiên với nRF Connect

> Thực hiện trước khi lắp đặt và trước khi Burn cấu hình. Mục tiêu: biết tầm phát và RSSI thực tế của bo này trong điều kiện dùng thật.

**Chuẩn bị:**
- Điện thoại Android đã cài **nRF Connect** (Nordic Semiconductor).
- Beacon đã được cấp điện (qua cổng BAT_IN hoặc cổng cấu hình — xem tài liệu hãng, không đoán cách nối).
- Thước đo, băng dính để đánh dấu khoảng cách.

**Lưu ý quan trọng về Android:** Android giới hạn quét BLE nền để tiết kiệm pin. Khi đo RSSI, giữ màn hình bật và app nRF Connect ở foreground; đừng để màn hình tắt.

**Các bước:**
1. Bật Bluetooth trên điện thoại. Cấp quyền vị trí cho nRF Connect khi được hỏi (Android yêu cầu quyền vị trí để quét BLE).
2. Mở nRF Connect → tab **Scanner** → bấm **Scan**.
3. Tìm beacon theo tên (thường là tên mặc định của chip hoặc tên đã cấu hình qua Run in RAM). Nếu chưa cấu hình tên, tìm theo địa chỉ MAC trên nhãn bo.
4. Đứng cách beacon **1 m** (đo bằng thước), giữ điện thoại ngang tay.
5. Ghi RSSI (dBm) liên tục trong **30–60 giây**, tính trung bình.
6. Lặp lại ở **2 m** và **4 m**.
7. Lặp lại mỗi khoảng cách ở ít nhất 2 điều kiện khác nhau: hành lang trống và hành lang có người đi lại.

**Bảng ghi chép mẫu:**

| Khoảng cách | RSSI trung bình (dBm) | Số mẫu | Điều kiện | Ghi chú |
|---|---|---|---|---|
| 1 m | | | Hành lang trống | |
| 1 m | | | Hành lang đông | |
| 2 m | | | Hành lang trống | |
| 2 m | | | Hành lang đông | |
| 4 m | | | Hành lang trống | |
| 4 m | | | Hành lang đông | |

Lưu bảng này vào `data/` hoặc ghi vào `docs/HARDWARE.md` mục "Chưa xác minh" khi có kết quả.

---

## 9. Công cụ bench test BLE trên laptop (bench/)

Để kiểm tra tín hiệu beacon trực tiếp từ laptop (không cần điện thoại), dùng công cụ bench tại thư mục `bench/`:

1. Chạy app: `npm run dev`
2. Mở trình duyệt: **http://localhost:5173/bench/index.html**
3. Nhấn **"Kiểm tra trình duyệt"** — kiểm tra Web Bluetooth khả dụng không.
4. Tải bảng ánh xạ beacon → phòng (nhấn "Tải mẫu" hoặc nhập UUID/Major/Minor thật sau khi Run in RAM xong).
5. Chọn **"Nguồn THẬT"** → nhấn "Bắt đầu quét" để nhận gói BLE từ beacon thật (cần bật cờ trình duyệt — xem `bench/README.md`).
6. Hoặc chọn **"Nguồn giả lập"** → chọn kịch bản → nhấn "Bắt đầu giả lập" để thử bộ phân giải mà không cần beacon thật.
7. Dùng nút **"Ghi mẫu"** + **"Xuất CSV"** để lưu kết quả bench test thực tế.

> Giới hạn: không chạy được trên iOS Safari; Windows có thể nhận gói quảng bá của chính hệ điều hành.
> Xem chi tiết: [`bench/README.md`](bench/README.md)

**Đo RSSI chuẩn từng bước (bench test thực tế):**

1. Trước khi đo, tạo file `data/beacon-map.local.json` (xem HUONG_DAN.md mục 10).
2. Mở bench: `http://localhost:5173/bench/index.html`.
3. Nhấn **"Tải local (beacon-map.local.json)"** để dùng UUID thật.
4. Mở **"Nguồn THẬT"** → nhấn **"Bắt đầu quét"**.
5. Đặt beacon tại vị trí cố định. Dùng thước đo đặt laptop (hoặc điện thoại nếu dùng proxy) cách beacon đúng khoảng cách cần đo.

   **E5.** Trong khi cầu nối đang chạy, mở terminal khác và chạy chẩn đoán để xác nhận bridge đang thấy đúng beacon:
   ```bash
   python tools/beacon_setup/diagnose_beacons.py --duration 10
   ```
   Báo cáo sẽ liệt kê: beacon KHỚP (id, RSSI trung bình, gói/s), beacon LỆCH (UUID/Major/Minor không khớp file), beacon THIẾU. Chỉ tiếp tục đo khi tất cả beacon cần đo đều hiện ở mục KHỚP.

6. Trong mục "7. Ghi mẫu đo": nhập `beaconRef` (ví dụ `B01`), chọn khoảng cách, điền điều kiện.
7. Ghi liên tục trong **≥60 giây** mỗi mốc (0.5 / 1 / 2 / 4 / 8 m, mỗi mốc đo 2 lần: có và không vật cản).
8. Nhấn **"Xuất CSV"** — lưu file vào `bench/measurements/`. File CSV này **gitignored**, không commit.
9. Điền kết quả tóm tắt (trung bình, σ) vào bảng trong [`docs/HARDWARE.md`](docs/HARDWARE.md) mục 9.
10. Chạy `node tools/suggest-thresholds.mjs bench/measurements/<file>.csv` để xem đề xuất ngưỡng.

---

## 10. Kiểm thử app chính với beacon thật (`?beacon=real`)

**Yêu cầu trước:**
- Beacon Run in RAM đang phát tín hiệu.
- File `data/beacon-map.local.json` đã được tạo với UUID/Major/Minor thật và `roomId` đúng (xem bước dưới).

**Tạo `data/beacon-map.local.json`:**
1. Mở file `data/beacon-map.local.json` (đã có template từ CP-BLE-REAL).
2. Thay `"ĐIỀN-UUID-THẬT-lower-MAJOR-MINOR"` bằng beaconKey thật, dạng `<uuid-chữ-thường>-<major>-<minor>` (ví dụ: `abcd1234-0000-0000-0000-000000000000-1-1`).
3. Thay `roomId` bằng ID phòng gần beacon nhất (ví dụ `F1_R001`).
4. **Không commit file này** — đã gitignored.

**Chạy app với BLE thật:**
1. `npm run dev`
2. Chrome/Edge: bật `chrome://flags/#enable-experimental-web-platform-features` (hoặc `#enable-web-bluetooth-new-permissions-backend`).
3. Mở `http://localhost:5173/?beacon=real`
4. Cấp quyền Bluetooth khi trình duyệt hỏi.
5. Lại gần beacon (< 2 m) → đợi ≤ 2 giây → dot vị trí chuyển màu, hiển thị tên phòng.
6. Tắt nguồn beacon → đợi ≤ 10 giây → toast "Mất tín hiệu beacon…" + banner hướng dẫn chọn vị trí thủ công.

---

## 11. Kiểm thử `?at=` trên iPhone qua mạng LAN

**Mục tiêu:** Xác nhận iPhone (không có BLE) có thể nhận vị trí xuất phát qua URL/QR — không cần HTTPS.

1. Laptop và iPhone phải cùng mạng WiFi.
2. Chạy: `npm run dev -- --host`
3. Terminal in ra địa chỉ IP LAN, ví dụ `http://192.168.1.x:5173`
4. Trên iPhone Safari: mở `http://192.168.1.x:5173/?at=F1_R001`
5. **Kỳ vọng:** toast "Vị trí xuất phát: [tên phòng]" hiện ra, marker xuất hiện đúng vị trí.
6. Thử `?at=PHONG_SAI` → toast "Không tìm thấy phòng…", app vẫn chạy bình thường.
7. Để sinh link QR cho từng phòng sau khi có domain HTTPS: `node tools/gen_qr_links.mjs https://<domain>`

> Lưu ý: Safari iOS không hỗ trợ Web Bluetooth — `?beacon=real` không dùng được. Dùng `?at=` (QR) thay thế.

---

## 8. Thử cấu hình beacon bằng Run in RAM

> ⚠️ **CẢNH BÁO QUAN TRỌNG — Đọc kỹ trước khi thao tác:**
> - **TUYỆT ĐỐI KHÔNG bấm nút "Burn" / "Program"** khi chưa có văn bản chốt cấu hình được chủ dự án phê duyệt. Thao tác Burn ghi vĩnh viễn vào eFuse, không đảo ngược được.
> - Xác nhận cáp USB-TTL (CP2102) là loại **3.3 V** trước khi nối vào bo. Cáp 5 V có thể hỏng bo.
> - Nối chân **đúng theo hình đấu nối trên wiki** ([wiki.dfrobot.com/tel0149/docs/22130](https://wiki.dfrobot.com/tel0149/docs/22130)). **Không đoán** — nối sai chiều TX/RX hoặc sai điện áp có thể hỏng bo.

**Mục tiêu của bước này:** thử cấu hình UUID/tên/chu kỳ phát thử nghiệm trong RAM để kiểm tra beacon hoạt động, trước khi Burn giá trị thật.

**Chuẩn bị:**
- Máy tính đã cài **NanoBeaconConfigTool** (NanoBeaconConfig.exe) từ [inplay-tech.com/config-tool](https://inplay-tech.com/config-tool/).
- Cáp CP2102 USB-TTL đã xác nhận là 3.3 V.
- Bo beacon chưa Burn (hoặc đang ở trạng thái RAM từ lần trước).

**Các bước chung:**
1. Nối cáp CP2102 vào máy tính qua USB. Xác nhận máy tính nhận cổng COM (xem Device Manager trên Windows).
2. Cấp điện cho bo beacon qua cổng BAT_IN (không qua P1 — xem tài liệu hãng).
3. Nối chân P1 của bo vào cáp CP2102 theo đúng hình đấu nối hãng (TX bo → RX cáp; RX bo → TX cáp; 3V3 bo ← 3V3 cáp; GND chung). **Xác nhận chiều trước khi nối.**
4. Mở NanoBeaconConfigTool → **Probe** → chọn cổng COM của CP2102 → **Connect**.
5. Điền các tham số thử: UUID thử (ví dụ UUID ngẫu nhiên, **không phải UUID thật của dự án**), Major/Minor thử, chu kỳ phát 1000 ms, công suất 0 dBm.
6. Bấm **Run in RAM** (không phải Burn/Program).
7. Mở nRF Connect trên điện thoại → quét → xác nhận beacon xuất hiện với UUID/tên vừa cấu hình.

**Trước lần thử thứ 2 trở đi:**
- Ngắt hoàn toàn nguồn khỏi bo (rút cáp nguồn BAT_IN), đợi 3–5 giây, rồi cắm lại.
- Lý do: theo kinh nghiệm với dòng TEL0168 (cùng chip IN100), không ngắt nguồn trước có thể khiến Run in RAM thứ 2 thất bại. Cần xác nhận cho TEL0149, nhưng khuyến nghị làm theo để an toàn.

**Sau khi thử xong:** ngắt nguồn bo, ghi lại kết quả vào bảng bench test (mục 7).

---

## 12. Hướng dẫn chạy demo (LocationSource + Dẫn đường + Cầu nối BLE)

### A. Chọn vị trí thủ công

1. Chạy server: `npm run dev:lan` → in địa chỉ LAN (ví dụ `http://172.16.29.99:5173`).
2. Mở URL trên điện thoại (cùng WiFi).
3. Bấm **Khám phá bản đồ 3D** → vào bản đồ.
4. Panel trái → **Vị trí của bạn** → **Chọn vị trí thủ công** → tìm phòng → bấm chọn.
   - Hoặc thêm `?from=F1_R001` vào URL để đặt vị trí ngay từ đầu.
5. Camera tự bay đến phòng, marker chấm xanh xuất hiện.

### B. Tìm đường và Bắt đầu dẫn đường

1. **Điểm xuất phát**: nhập phòng vào ô "Điểm xuất phát" (hoặc bấm nút 🎯 dùng vị trí đã chọn).
2. **Điểm đến**: nhập phòng vào ô "Điểm đến".
3. Bấm **Tìm đường đi** → tuyến đường vẽ màu trên bản đồ, chỉ dẫn từng bước.
4. Bấm **Bắt đầu dẫn đường →** → banner chữ lớn hiện ở dưới bản đồ.
5. Trong chế độ dẫn đường:
   - **✓ Tôi đã tới mốc này**: tiến bước tiếp theo.
   - **⊙ Về vị trí**: camera bay về marker vị trí hiện tại.
   - **✕ Thoát**: thoát chế độ dẫn đường.
   - Nếu lệch tuyến: banner vàng **"Có vẻ bạn đã lệch tuyến"** + nút **Tính lại**.

### C. Cầu nối BLE laptop → điện thoại (demo)

> **Yêu cầu:** laptop đang chạy `bridge.py` (xem mục 3) + Vite dev server.

**Trên laptop:**

1. Mở `http://localhost:5173/scan/` trong trình duyệt.
2. Cuộn xuống **"Cầu nối máy tính → Điện thoại"** → bấm **Kết nối cầu nối BLE**.
3. Mã 6 số hiện ra — ví dụ `382901`.

**Trên điện thoại:**

1. Mở `http://<LAN-IP>:5173` → bản đồ.
2. Panel trái → **Vị trí của bạn** → **Cầu nối máy quét BLE (demo)** (bấm để mở).
3. Nhập mã 6 số từ laptop → bấm **Kết nối**.
4. Điện thoại bắt đầu polling → khi laptop nhận được beacon gần phòng nào, marker sẽ dịch chuyển tới đó.
5. Nhãn **"Vị trí từ máy quét (demo)"** hiện trong trạng thái vị trí.
6. Nếu quá 15 giây không có dữ liệu → banner **"Mất tín hiệu – chọn mốc thủ công"**.

### D. Chế độ mock (?mock=1)

1. Thêm `?mock=1` vào URL bản đồ: `http://<LAN-IP>:5173/?mock=1`.
2. Tìm đường bất kỳ → bấm **Tìm đường đi** → chế độ mock tự chạy.
3. Nhãn **MOCK** đỏ hiện góc trên, marker di chuyển qua từng node trên tuyến mỗi 3 giây.

### E. Kiểm thử URL ?from= và xử lý lỗi

- `?from=F1_R001` → marker bay đến F1_R001, camera nghiêng 50°.
- `?from=KHONG_CO` → toast "Không tìm thấy phòng", không crash.
- Không nhập vị trí → tìm đường vẫn hoạt động (chọn thủ công từ gợi ý).

> Beacon thật chưa kết nối vào viewer — tất cả dữ liệu BLE là **demo/placeholder**. Nhãn "Vị trí từ máy quét (demo)" luôn hiển thị để phân biệt.

## 13. Gán vị trí beacon trên bản đồ 3D (chỉ dev server)

1. Cần có sẵn `data/beacons.local.json` (sao chép từ `data/beacons.local.example.json`, điền UUID/Major/Minor thật; file này bị gitignore). Công cụ **không** tự tạo file và **không** thêm beacon mới.
2. Chạy `npm run dev` trên máy tính, mở bản đồ 3D (không dùng `?kiosk`, không ở chế độ điện thoại). Trong thanh bên, mục "Gán beacon (dev)" → "Bật chế độ gán beacon".
3. Chọn beacon trong danh sách → chuyển sang chế độ một tầng, chọn đúng tầng → chạm điểm trên sàn. Marker màu cam là bản xem trước; chỉnh x/z/độ cao (m, mặc định 2.5) nếu cần → **Xác nhận** để ghi, **Hủy** để bỏ, **Gỡ vị trí** để xóa x/z.
4. Chỉ ghi `floorId, x, z, height_m`; UUID/Major/Minor không đi qua trình duyệt và không bị đổi. Trước lần ghi đầu của mỗi phiên dev, file được sao lưu thành `data/beacons.local.json.bak-<ngày>` (cũng gitignore).
5. Chỉ máy chạy dev server (loopback) mới ghi được; truy cập qua `dev:lan` từ điện thoại/máy khác bị từ chối. Bản `build`/`dist` không có chức năng này.
6. Hệ tọa độ: mét, gốc góc mặt bằng, x về đông, z về nam (Cần xác nhận). Hãy đối chiếu marker với chỗ gắn thật.

## 14. Demo điện thoại: tìm phòng có beacon và dẫn đường (thử nghiệm)

1. Trên laptop: `npm run dev`, mở `http://localhost:5173` (không dùng IP LAN, vì bản gán chỉ nhận loopback). Trong "Gán beacon (dev)" gán vị trí cho beacon (mục 13), sau đó bật "Chạm phòng để gắn", chạm một phòng trên bản đồ 3D để gắn beacon đang chọn vào phòng đó; "Gỡ phòng" để bỏ liên kết. Một phòng có thể có nhiều beacon (Cần xác nhận).
2. Chạy `npm run dev:lan`, mở địa chỉ mạng (ví dụ `http://<IP-laptop>:5173`) trên điện thoại cùng Wi-Fi. Điện thoại chỉ nhận danh sách rút gọn `/api/beacons/public` (id, tầng, x, z, phòng); UUID/Major/Minor và `data/beacons.local.json` bị chặn (HTTP 403) với mọi máy không phải loopback.
3. Chạm thanh tìm kiếm, bật chip "Có beacon", chọn phòng đích, chọn điểm xuất phát (phòng hoặc "Chạm trên bản đồ"), kiểm tra tóm tắt rồi bấm "Bắt đầu". Chấm xanh "Bạn ở đây · Vị trí demo" là vị trí do bạn chọn, không phải đo từ beacon; vị trí chỉ giữ trong bộ nhớ.
4. Chưa kiểm trên điện thoại thật và chưa kiểm với beacon thật (Cần xác nhận).

## 15. Giấy khám / lịch trình khám (bản thử nghiệm, dữ liệu demo)

1. Sau khi vào bản đồ, bấm nút "Giấy khám" (nhãn "Thử nghiệm", góc dưới bên trái).
2. Nhập mã mẫu `DEMO-0001`, `DEMO-0002` hoặc `DEMO-0003` (không phân biệt hoa/thường, bỏ khoảng trắng/gạch; O/0 và I/l/1 được đọc theo vị trí) rồi bấm "Tra cứu". Mã sai báo lỗi tiếng Việt.
3. Chọn nơi bạn đang đứng nếu chưa có vị trí, rồi bấm "Dẫn đường đến phòng này". Tới nơi bấm "Đã tới / Tiếp tục" để sang chặng kế (thủ công, chưa tự nhận bằng beacon). Có thể "Bỏ qua chặng" hoặc "Quay lại chặng này".
4. Dữ liệu nằm ở `data/visit_plans.sample.json` (toàn dữ liệu giả). Mã thật và hệ thống bệnh viện (HIS): Cần xác nhận; dữ liệu sức khỏe thật cần backend. Mã chỉ giữ trong bộ nhớ, không lưu trữ.
5. Chưa kiểm trực quan trên trình duyệt/điện thoại (Cần xác nhận).
