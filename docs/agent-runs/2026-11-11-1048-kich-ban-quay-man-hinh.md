# Kịch bản quay màn hình: từ cấu hình beacon đến dùng trên điện thoại

> Ngày soạn: 2026-11-11 · Loại: tài liệu (không sửa mã) · Thời lượng dự kiến: 9–10 phút · Giọng đọc: xưng "tôi", trang trọng, báo cáo cấp trên.
> Nguồn thao tác: `HUONG_DAN.md` (mục 7, 8, 12, 13, 14), `docs/HARDWARE.md`, `tools/beacon_bridge/README.md`, `package.json`, `tools/dev-lan.mjs`.
> **Kịch bản chưa được quay thử.** Mọi chỗ ghi "Cần xác nhận" phải kiểm khi quay thử một lượt trước khi quay chính thức.

## 1. Nguyên tắc khi quay (đọc trước)

1. **Không để lộ UUID dự án.** NanoBeaconConfigTool, `data/beacons.local.json`, kết quả `diagnose_beacons.py`, trang `beacon-admin` đều có thể hiện UUID. Dùng **UUID thử** trong cảnh 1; các cảnh còn lại che/làm mờ ô UUID khi dựng (hoặc chỉ cuộn tới phần Major/Minor/vị trí, không để UUID vào khung hình).
2. **Tuyệt đối không bấm Burn / Program** trên NanoBeaconConfigTool, kể cả khi quay. Chỉ dùng **Run in RAM**. Burn ghi vĩnh viễn vào eFuse, chỉ chủ dự án làm sau khi có văn bản chốt cấu hình.
3. **Nói đúng mức độ hoàn thành:** dữ liệu là thử nghiệm; vị trí trên điện thoại là "Vị trí demo" do người dùng chọn, **chưa** tự đo từ beacon; chưa kiểm hiện trường; chưa có số liệu sai số. Không nói "chính xác", "đã triển khai", "đã thử tại bệnh viện".
4. **Thứ tự bắt buộc:** gán beacon lên bản đồ 3D (cảnh 5) chỉ chạy được trên máy chủ chạy `npm run dev` truy cập bằng `localhost`; `npm run dev:lan` (cảnh 6) dùng chung cổng 5173 nên phải **dừng `dev` trước**. Điện thoại chỉ nhận danh sách beacon rút gọn (id, tầng, x, z, phòng), không có UUID.
5. Quay màn hình laptop ở 1920×1080, cỡ chữ terminal ≥ 18 pt. Quay điện thoại bằng chức năng ghi màn hình riêng, giữ dọc, bật "Không làm phiền".
6. Mỗi cảnh quay riêng một đoạn, ghép sau; lời thoại có thể thu riêng nếu muốn.

## 2. Checklist trước khi quay

**Phần cứng**
- [ ] Bo beacon DFRobot TEL0149; cáp CP2102 đã xác nhận **3,3 V** (xem nhãn/datasheet; Cần xác nhận). Hình đấu nối của hãng mở sẵn: wiki.dfrobot.com/tel0149/docs/22130. Không đoán chiều TX/RX.
- [ ] Nguồn cấp cho bo qua cổng BAT_IN (không qua P1).
- [ ] Điện thoại Android có nRF Connect (cảnh 2); điện thoại dùng để demo cuối (cảnh 7).
- [ ] Laptop và điện thoại **cùng Wi-Fi**.

**Phần mềm (laptop Windows)**
- [ ] NanoBeaconConfigTool (NanoBeaconConfig.exe) đã cài.
- [ ] Python venv của bridge đã cài: `tools/beacon_bridge/.venv` (`pip install -r requirements.txt`).
- [ ] `npm install` đã xong; `npm test` xanh (tùy chọn, không quay).
- [ ] Đã có `data/beacons.local.json` (copy từ `data/beacons.local.example.json` nếu chưa có). **Sao lưu file thật trước khi quay.**
- [ ] Đóng mọi cửa sổ có thông tin cá nhân; tắt thông báo.

**Chuẩn bị dữ liệu quay**
- [ ] Chọn sẵn 1 beacon (ví dụ `F1_B01`), 1 phòng đích và 1 điểm xuất phát có đường đi (tầng 1 để đơn giản; nếu đi liên tầng thì chuẩn bị thêm lời thoại ở cảnh 7).
- [ ] Chụp sẵn ảnh màn hình nRF Connect và NanoBeaconConfigTool khi đã Run in RAM thành công (dự phòng).

## 3. Tổng quan cảnh

| # | Cảnh | Thời lượng | Màn hình chính |
|---|---|---|---|
| 0 | Mở đầu | 0:40 | Slide/ảnh sơ đồ luồng |
| 1 | Cấu hình beacon bằng NanoBeaconConfigTool | 1:45 | Bo mạch + NanoBeaconConfigTool |
| 2 | Xác nhận bằng nRF Connect | 0:45 | Điện thoại (nRF Connect) |
| 3 | Khai báo beacon trong dự án | 1:00 | Terminal + `beacons.local.json` |
| 4 | Cầu nối BLE + Quản trị Beacon | 1:15 | Terminal + trình duyệt `beacon-admin.html` |
| 5 | Gán beacon lên bản đồ 3D | 1:30 | Trình duyệt `localhost:5173` |
| 6 | Chạy `npm run dev:lan` | 0:30 | Terminal |
| 7 | Dùng trên điện thoại | 2:00 | Màn hình điện thoại |
| 8 | Kết luận | 0:45 | Slide/ảnh tóm tắt |
| | **Tổng** | **≈ 10:10** | Cắt bớt lời ở cảnh 3–4 nếu cần xuống 9 phút |

---

## Cảnh 0 — Mở đầu (0:40)

**Màn hình:** một slide hoặc ảnh sơ đồ luồng (vẽ tay cũng được): `Beacon BLE → Laptop (cầu nối) → Bản đồ 3D → Điện thoại`.

**Thao tác:**
1. Hiện slide tiêu đề: "Dẫn đường trong nhà – Bệnh viện Quân y 7A".
2. Chỉ lần lượt từng khối trên sơ đồ khi nói.

**Lời thoại:**
> Kính chào anh/chị. Tôi xin trình bày thao tác sử dụng phần mềm dẫn đường trong nhà cho Bệnh viện Quân y 7A, từ bước cấu hình beacon cho đến khi sử dụng trên điện thoại.
> Hệ thống gồm bốn khối: các beacon Bluetooth gắn trong tòa nhà; máy tính làm cầu nối thu tín hiệu; bản đồ ba chiều của bệnh viện; và điện thoại của người dùng.
> Lưu ý trước: đây là bản thử nghiệm, dùng dữ liệu thử; tôi sẽ nói rõ những phần nào đã chạy và những phần nào chưa kiểm tại hiện trường.

---

## Cảnh 1 — Cấu hình beacon bằng NanoBeaconConfigTool (1:45)

**Màn hình:** quay bo mạch (cận cảnh) rồi chuyển sang cửa sổ NanoBeaconConfigTool.

**Thao tác:**
1. Quay cận cảnh bo TEL0149, cáp CP2102 và nhãn "3.3V" của cáp. (Khi quay phần đấu dây, đối chiếu với hình đấu nối của hãng; không đoán chiều TX/RX.)
2. Cắm cáp CP2102 vào laptop. Mở Device Manager → mục Ports (COM) → chỉ ra cổng COM xuất hiện.
3. Cấp nguồn cho bo qua BAT_IN. (Nếu đã đấu sẵn: chỉ quay cận cảnh kết quả, nói rõ "đã đấu theo sơ đồ hãng".)
4. Mở **NanoBeaconConfigTool** → bấm **Probe** → chọn cổng COM của CP2102 → **Connect**.
5. Điền tham số thử: **UUID thử** (không phải UUID dự án), Major/Minor thử, chu kỳ phát 1000 ms, công suất 0 dBm.
6. Bấm **Run in RAM** (nút khác Burn/Program). Dừng khung hình ở thông báo thành công.
7. Di chuột lướt qua nút **Burn/Program** nhưng **không bấm**; chèn chữ cảnh báo trên hình khi dựng.

**Lời thoại:**
> Bước đầu tiên là cấu hình beacon. Thiết bị tôi dùng là bo BLE của DFRobot, kết nối với máy tính qua cáp USB–TTL CP2102 loại 3,3 vôn.
> Trong công cụ NanoBeaconConfig, tôi bấm Probe để dò cổng, chọn đúng cổng COM, rồi bấm Connect.
> Tôi nhập các thông số thử nghiệm gồm mã định danh, Major, Minor, chu kỳ phát một giây và công suất 0 dBm, sau đó chọn Run in RAM.
> Run in RAM chỉ nạp cấu hình vào bộ nhớ tạm, mất đi khi ngắt điện, nên an toàn để thử. Tôi cố ý không dùng Burn: Burn ghi vĩnh viễn vào bộ nhớ của chip, không đảo ngược được, và chỉ thực hiện sau khi có văn bản chốt cấu hình do chủ dự án phê duyệt.

**Lưu ý / che cảnh báo:**
- Làm mờ ô UUID nếu dùng UUID khác UUID thử. Không đưa UUID thật vào lời thoại.
- Lần Run in RAM thứ 2 trở đi: rút nguồn BAT_IN, đợi 3–5 giây, cắm lại rồi mới thử lại (khuyến nghị của hãng cho dòng cùng chip; Cần xác nhận cho TEL0149).
- Nếu Probe không thấy cổng: kiểm tra driver CP2102, cáp có dây dữ liệu, chiều TX/RX theo hình hãng. Dùng ảnh chụp dự phòng thay cho cảnh quay.

---

## Cảnh 2 — Xác nhận beacon đang phát bằng nRF Connect (0:45)

**Màn hình:** màn hình điện thoại Android (ghi màn hình) mở nRF Connect.

**Thao tác:**
1. Bật Bluetooth và quyền vị trí; mở nRF Connect → tab **Scanner** → bấm **Scan**.
2. Tìm beacon theo tên hoặc địa chỉ MAC trên nhãn bo; chạm vào để xem chi tiết, chỉ ra RSSI (dBm). Che UUID khi dựng.
3. Giữ màn hình bật và app ở foreground trong lúc quay (Android hạn chế quét nền).

**Lời thoại:**
> Để chắc chắn beacon thật sự phát tín hiệu, tôi dùng ứng dụng nRF Connect trên điện thoại. Tôi bấm quét và thấy beacon xuất hiện cùng cường độ tín hiệu RSSI, tính bằng dBm.
> Đây mới là kiểm tra có/không. Việc đo RSSI theo khoảng cách để hiệu chỉnh hệ thống chưa thực hiện, nên hiện chưa có số liệu sai số.

---

## Cảnh 3 — Khai báo beacon trong dự án (1:00)

**Màn hình:** terminal PowerShell tại thư mục dự án, rồi soạn thảo mở `data/beacons.local.json`.

**Thao tác:**
1. (Nếu chưa có) tạo UUID dự án:
   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\beacon_setup\new_project_uuid.ps1
   ```
   Khi dựng: che dòng in ra UUID.
2. Mở `data/beacons.local.json`; **chỉ cuộn tới phần Major/Minor, tầng, vị trí**. UUID không để vào khung hình (hoặc làm mờ).
3. Chạy kiểm tra file:
   ```bash
   python tools/beacon_setup/validate_beacons.py
   ```
   Dừng ở kết quả hợp lệ.

**Lời thoại:**
> Sau khi beacon phát đúng, tôi khai báo nó vào dữ liệu của dự án. Mỗi beacon được nhận diện bằng bộ ba mã định danh, Major và Minor, ghi trong một tệp cục bộ không đưa lên kho mã nguồn, để tránh lộ thông tin.
> Tôi chạy công cụ kiểm tra để bảo đảm tệp khai báo hợp lệ trước khi đo. Kết quả không có lỗi.

**Lưu ý:** Nếu `validate_beacons.py` báo lỗi khi quay, sửa trước rồi quay lại cảnh; không cắt ghép che lỗi. File `beacons.local.json` có UUID thật chỉ hiện sau khi đã làm mờ.

---

## Cảnh 4 — Cầu nối BLE và trang Quản trị Beacon (1:15)

**Màn hình:** chia đôi: terminal (trái), trình duyệt (phải).

**Thao tác:**
1. Terminal 1 (đã kích hoạt venv):
   ```bash
   python tools/beacon_bridge/bridge.py --beacons data/beacons.local.json
   ```
2. Terminal 2 (mở thêm): chạy `npm run dev` (nếu chưa chạy), rồi mở trình duyệt `http://localhost:5173/beacon-admin.html`.
3. Trong trang: chọn nguồn **Bridge (ws://127.0.0.1:8765)** → chỉ vào danh sách **Beacon đã đăng ký** thấy beacon xuất hiện, RSSI thay đổi.
4. Terminal 3:
   ```bash
   python tools/beacon_setup/diagnose_beacons.py --duration 10
   ```
   Chỉ vào mục **KHỚP**; che dòng hiện UUID.

**Lời thoại:**
> Tiếp theo, tôi chạy chương trình cầu nối. Chương trình này dùng Bluetooth của máy tính để nghe tín hiệu, chỉ chấp nhận những beacon có trong danh sách đã khai báo, và chỉ phát dữ liệu trong nội bộ máy tính.
> Trên trang Quản trị Beacon, tôi chọn nguồn Bridge. Beacon hiện trong danh sách đã đăng ký, kèm cường độ tín hiệu cập nhật liên tục.
> Công cụ chẩn đoán cho biết beacon khớp với tệp khai báo. Như vậy phần thu tín hiệu từ beacon thật vào phần mềm đã thông.

**Lưu ý:**
- Chỉ nói "thông" nếu chính cảnh quay hiện beacon ở mục KHỚP. Nếu không, đổi sang lời nói "đang chẩn đoán" và dùng phương án dự phòng.
- Bridge chỉ lắng nghe 127.0.0.1; không mở ra mạng ngoài (đã ghi trong README bridge).
- Cần xác nhận: trình duyệt `beacon-admin` hiện dữ liệu từ file có UUID qua dev server (HANDOVER còn ghi là rủi ro riêng). Che UUID khi quay.

---

## Cảnh 5 — Gán beacon lên bản đồ 3D (1:30)

**Màn hình:** trình duyệt trên laptop: `http://localhost:5173` (không dùng IP LAN, không `?kiosk`).

**Thao tác:**
1. Đảm bảo `npm run dev` đang chạy (từ cảnh 4). Mở `http://localhost:5173`, bấm **Khám phá bản đồ 3D** (nếu có màn hình chào).
2. Thanh bên → mục **Gán beacon (dev)** → bấm **Bật chế độ gán beacon**.
3. Chọn beacon (ví dụ `F1_B01`) trong danh sách → chuyển sang chế độ **một tầng**, chọn đúng tầng.
4. Chạm điểm trên sàn → thấy marker màu cam (bản xem trước) → chỉnh độ cao nếu cần (mặc định 2,5 m) → bấm **Xác nhận**.
5. Bật **Chạm phòng để gắn** → chạm một phòng gần beacon → phòng được gắn. (Bấm **Gỡ phòng** để bỏ liên kết nếu cần minh họa.)

**Lời thoại:**
> Beacon cần được đặt đúng vị trí trên bản đồ ba chiều. Trong chế độ gán beacon, tôi chọn beacon, chọn tầng, rồi chạm vào điểm thực tế mà beacon được gắn.
> Hệ thống chỉ ghi tầng, tọa độ và độ cao; mã định danh của beacon không đi qua trình duyệt. Chức năng này chỉ hoạt động trên máy chủ của người cấu hình, người dùng khác không thể thay đổi.
> Sau đó tôi gắn beacon với phòng gần nhất để người dùng có thể tìm phòng có beacon.
> Tọa độ hiện dùng cho minh họa; vị trí thực tế sẽ được đối chiếu với nơi gắn tại hiện trường.

**Lưu ý:**
- Chức năng này **chưa kiểm trực quan trên trình duyệt** (theo HANDOVER) → bắt buộc quay thử trước.
- Chỉ ghi vào `data/beacons.local.json` của máy này; đã có bản sao lưu `data/beacons.local.json.bak-<ngày>` tự tạo mỗi phiên dev.
- Hệ trục z và số tầng thực dựng (3 hay 9): Cần xác nhận. Chọn tầng 1 để tránh lỗi.

---

## Cảnh 6 — Chạy `npm run dev:lan` (0:30)

**Màn hình:** terminal.

**Thao tác:**
1. Dừng `npm run dev` (Ctrl+C) ở terminal đang chạy.
2. Chạy:
   ```bash
   npm run dev:lan
   ```
3. Chỉ vào hai dòng in ra: `Local: http://localhost:5173` và `Network: http://<IP-laptop>:5173 ← mở link này trên điện thoại cùng Wi-Fi`. Che/ghi chú IP nếu cần (IP nội bộ, không nhạy cảm nhưng vẫn nên làm mờ khi chia sẻ ngoài).

**Lời thoại:**
> Để người dùng mở bản đồ trên điện thoại, tôi khởi động máy chủ ở chế độ mạng nội bộ bằng lệnh npm run dev:lan. Máy chủ in ra địa chỉ mạng, điện thoại cùng Wi-Fi chỉ cần mở địa chỉ này.
> Ở chế độ này, điện thoại chỉ nhận danh sách rút gọn gồm tên beacon, tầng, tọa độ và phòng; mã định danh beacon bị chặn với mọi máy khác máy chủ.

**Lưu ý:** Nếu không có dòng "Network" (không thấy IP LAN) → kiểm tra Wi-Fi; điện thoại sẽ không vào được. Phải nối Wi-Fi trước khi quay cảnh này.

---

## Cảnh 7 — Dùng trên điện thoại (2:00)

**Màn hình:** màn hình điện thoại (ghi màn hình), dọc.

**Thao tác:**
1. Mở trình duyệt điện thoại → gõ `http://<IP-laptop>:5173`.
2. Bấm **Khám phá bản đồ 3D** → hiện bản đồ, xoay/chụm thử vài giây.
3. Chạm thanh tìm kiếm ("Tìm phòng theo tên hoặc mã…") → bật chip **Có beacon** → danh sách chỉ còn phòng có beacon → chọn phòng đích.
4. Màn hình **Chỉ đường**: chạm **Điểm xuất phát** → chọn **Chọn từ danh sách** (hoặc **Chạm trên bản đồ**) → chọn điểm xuất phát.
5. Xem tóm tắt tuyến (khoảng cách ước tính, số lần đổi tầng) → bấm **Bắt đầu**.
6. Chế độ dẫn đường: banner chữ lớn từng bước, camera tới vị trí; đi tiếp bước; kết thúc bằng **Kết thúc**.
7. (Tùy chọn 10 giây) chạm vào chấm "Bạn ở đây · Vị trí demo" để chỉ nhãn.

**Lời thoại:**
> Bây giờ tôi dùng điện thoại, mở địa chỉ vừa rồi và chọn Khám phá bản đồ 3D.
> Tôi tìm phòng cần đến. Bộ lọc "Có beacon" chỉ hiện những phòng đã gắn beacon. Tôi chọn phòng đích, sau đó chọn điểm xuất phát bằng danh sách hoặc chạm trực tiếp trên bản đồ.
> Hệ thống tính tuyến đường, hiển thị khoảng cách ước tính và số lần đổi tầng. Tôi bấm Bắt đầu, và chỉ dẫn từng bước hiện bằng chữ lớn, dễ đọc.
> Xin lưu ý: chấm "Bạn ở đây" hiện nhãn "Vị trí demo". Đây là vị trí do người dùng chọn, **chưa** được suy ra tự động từ beacon trên điện thoại; trình duyệt trên điện thoại cần kết nối bảo mật HTTPS và trên iPhone không hỗ trợ đọc beacon trực tiếp. Hướng hoàn thiện là ứng dụng riêng hoặc cầu nối máy quét.
> Tuyến, khoảng cách và dữ liệu phòng hiện là dữ liệu thử nghiệm, chưa kiểm tại hiện trường và chưa kiểm trên điện thoại thật theo kịch bản chính thức.

**Lưu ý:**
- Chip "Có beacon" **chỉ hiện khi** máy chủ trả về danh sách beacon đã gắn phòng (`/api/beacons/public`). Nếu chip không hiện: kiểm tra cảnh 5 đã gắn phòng và đang chạy `dev:lan` (không phải `build`).
- Điện thoại phải đang ≤700 px (màn hình dọc điện thoại) để thấy luồng di động. Không thêm `?kiosk`.
- Giới hạn đã biết (PROJECT_STATUS): 6/84 phòng F2/F3 không có tuyến xe lăn từ phòng F1 đầu; chưa chạy trên điện thoại thật theo ghi chép trước. **Hãy quay thử trên điện thoại thật trước.**

---

## Cảnh 8 — Kết luận (0:45)

**Màn hình:** slide tóm tắt hai cột "Đã làm" / "Chưa làm".

**Thao tác:** hiện slide, đọc lần lượt từng cột.

**Lời thoại:**
> Tóm lại, tôi đã trình bày quy trình từ cấu hình beacon ở chế độ thử, khai báo và kiểm tra tín hiệu, gán vị trí lên bản đồ ba chiều, đến sử dụng trên điện thoại để tìm phòng và dẫn đường.
> Những việc chưa làm: ghi cấu hình vĩnh viễn lên beacon khi chưa có văn bản chốt; đo hiệu chỉnh tín hiệu theo khoảng cách; kiểm thử tại hiện trường; và định vị tự động trên điện thoại, cần HTTPS hoặc ứng dụng riêng.
> Tôi xin đề xuất các bước tiếp theo: chốt cấu hình beacon, khảo sát vị trí lắp đặt, đo hiệu chỉnh và thử nghiệm tại một khoa. Xin cảm ơn anh/chị đã theo dõi.

---

## 4. Phương án dự phòng khi lỗi giữa chừng

| Sự cố | Cách xử lý khi quay |
|---|---|
| Probe không thấy cổng COM / Run in RAM lỗi | Rút nguồn BAT_IN 3–5 s, cắm lại; kiểm driver, chiều dây theo hình hãng. Dự phòng: dùng ảnh chụp thành công đã chuẩn bị và nói rõ "ảnh chụp từ lần thử trước" |
| nRF Connect không thấy beacon | Giữ màn hình bật, cấp quyền vị trí, đứng gần hơn; hoặc dùng ảnh chụp |
| Bridge không thấy beacon (KHỚP rỗng) | Kiểm tệp khai báo (UUID/Major/Minor khớp lúc Run in RAM); chạy lại `diagnose_beacons.py`. Dự phòng: nguồn **Mock Replay** trên trang `beacon-admin`, nói rõ là giả lập |
| Không vào được trang trên điện thoại | Kiểm cùng Wi-Fi, tường lửa Windows cho Node/Vite; dùng đúng dòng Network |
| Chip "Có beacon" không hiện | Gắn lại phòng ở cảnh 5; dừng `dev` rồi chạy `dev:lan`; nếu vẫn lỗi, bỏ chip và tìm phòng bình thường (nói rõ) |
| Muốn minh họa vị trí nhanh | Thêm `?from=F1_R001` vào URL (đặt vị trí đầu); `?mock=1` cho chế độ mô phỏng (hiện nhãn **MOCK** đỏ, nói rõ là mô phỏng) |

## 5. Cần xác nhận (ghi rõ vì chưa kiểm)

1. Kịch bản **chưa quay thử**; chưa chạy toàn bộ chuỗi trên điện thoại thật (HUONG_DAN mục 14 và PROJECT_STATUS ghi "chưa kiểm trên điện thoại thật, chưa kiểm với beacon thật").
2. Chế độ gán beacon 3D (cảnh 5) **chưa kiểm trực quan trên trình duyệt**.
3. Điện áp cáp CP2102 là 3,3 V; chiều TX/RX theo hình hãng; Run in RAM lần 2 có cần ngắt nguồn không (đối với TEL0149).
4. Hướng trục z, số tầng thực dựng (3 hay 9), tọa độ beacon `F1_B01` có thể là tạm.
5. Việc `beacon-admin` tải file có UUID qua dev server (kể cả `dev:lan`): rủi ro đã ghi trong HANDOVER, cần quyết riêng; trong lúc quay, tránh để UUID vào khung hình.
6. Số liệu hiệu chỉnh RSSI/sai số: chưa có (HARDWARE.md mục 9: "Cần đo").

## 6. Khuyến nghị: quay thử một lượt, 15–20 phút

1. Chạy đủ chuỗi cảnh 1 → 7 không quay, ghi lỗi gặp phải.
2. Sửa chỗ nào không khớp thực tế vào file này (không bịa kết quả).
3. Quay chính thức từng cảnh; dựng, làm mờ UUID, thêm chữ cảnh báo Burn ở cảnh 1.
