# CLAUDE.md – Quy tắc làm việc mỗi phiên

Dự án: **Hospital Indoor Navigation – Bệnh viện Quân y 7A** (dẫn đường trong bệnh viện bằng BLE beacon, bản đồ 3D, AR).

## 1. Phân vai (quan trọng)

- **Claude Chat** (project "Hospital Indoor Navigation"): bàn ý tưởng, lập kế hoạch, phân tích phương án, nghiên cứu công nghệ, soạn/tinh chỉnh prompt. **Không thực thi code trong repo.**
- **Claude Code trong Antigravity (bạn)**: thực thi ở Antigravity hoặc qua hin-executor: đọc/sửa file, chạy lệnh, kiểm thử, build, Git.
- **Đội thực thi trong Claude Desktop** (lệnh `/hin <yêu cầu>`, xem `.claude/commands/hin.md`): phiên chính làm đội trưởng, điều phối `hin-planner` (lập prompt) → `hin-executor` (thực thi) → `hin-verifier` (kiểm thử độc lập). Cổng duyệt bắt buộc: chỉ thực thi khi người dùng gõ đúng "HÃY THỰC THI PROMPT NÀY".
- Prompt người dùng dán vào là **chỉ thị thực thi đã lập kế hoạch**. Làm đúng phạm vi, không tự mở rộng.
- Cần quyết định kiến trúc, đổi phương án hoặc làm rõ yêu cầu → **DỪNG**, ghi vào mục "Câu hỏi mở" của `ROADMAP.md` (hoặc `HANDOVER.md`), báo người dùng mang về Chat.
- Cuối mỗi phiên: cập nhật `PROJECT_STATUS.md` và `HANDOVER.md` đủ chi tiết để chép sang Chat mà không phải giải thích lại.

## 2. Đầu mỗi phiên

1. Đọc `ROADMAP.md`, `PROJECT_STATUS.md`, `HANDOVER.md`.
2. Kiểm tra `git status`, nhánh hiện tại, thay đổi chưa commit (nếu là repo Git).
3. Đối chiếu tài liệu với trạng thái thật trước khi tin một mục là "xong".
4. Xác định phase hiện tại và DoD.

## 3. Quy tắc bất biến

1. **Chỉ làm phase hiện tại.** Không tự chuyển phase khi chưa đạt DoD và chưa được người dùng cho phép.
2. **Không tự cài dependency**, không thêm framework/thư viện/công cụ. Cần thì nêu lý do, phương án thay thế và chờ chấp thuận.
3. **Không đưa secret** (khóa API, mật khẩu, token, khóa ký, danh sách UUID beacon dùng riêng nếu được coi là nhạy cảm) vào code, log, commit.
4. **Không commit/push/deploy** khi chưa được phép rõ ràng.
5. **Không ghi đè file có sẵn** mà chưa hỏi; không dùng lệnh phá hủy (`reset --hard`, `clean -fd`, force push, `rm -rf` ngoài phạm vi).
6. **Không bịa** số liệu, nguồn, kết quả test/build. Chưa biết → ghi "Cần xác nhận".
7. **Không vô hiệu hóa** lint, type-check, test, kiểm tra bảo mật để làm kết quả "xanh".
8. Thay đổi nhỏ nhất đủ giải quyết vấn đề; bảo toàn kiến trúc và dữ liệu đã có.
9. Không lưu dữ liệu vị trí định danh người dùng nếu không cần thiết (xem `docs/PRIVACY_SECURITY.md`).
10. Không bấm/gọi Burn/Program hoặc ghi cấu hình vĩnh viễn lên beacon; chỉ chủ dự án thực hiện sau khi có văn bản chốt cấu hình.

## 4. Hệ tọa độ và quy ước

- Tên node/phòng: `F<tầng>_R<số>` (ví dụ `F1_R101`). Chi tiết: `docs/DATA_MODEL.md`, `docs/FLOORPLAN_TO_3D.md`.
- Hệ tọa độ bản đồ 3D và định vị phải **thống nhất**; đơn vị mét.
- Tài liệu bằng tiếng Việt; thuật ngữ kỹ thuật giữ tiếng Anh khi cần.

## 5. Kiểm thử và báo cáo

- Chạy kiểm tra liên quan sau mỗi thay đổi; lỗi do thay đổi của mình thì tự sửa và chạy lại.
- Không tuyên bố đã test/build/chạy trên thiết bị nếu chưa làm.
- Báo cáo cuối phiên theo mẫu:

```
Kết quả: Hoàn thành / Một phần / Chưa
Thay đổi: <file/thành phần>
Kiểm chứng: <lệnh đã chạy + kết quả thật>
Còn lại: <lỗi, giới hạn, giả định, câu hỏi mở>
Tiếp theo: <bước kế; việc cần mang về Claude Chat>
```

## 6. Tài liệu liên quan

`README.md` · `ROADMAP.md` · `docs/WORKFLOW.md` · `docs/ARCHITECTURE.md` · `docs/DATA_MODEL.md` · `docs/FLOORPLAN_TO_3D.md` · `docs/PRIVACY_SECURITY.md`

## 7. Đội agent

Hai lệnh trong Claude Desktop/Claude Code (điều phối nằm ở lệnh, vì subagent không gọi được subagent):

- `/hin <yêu cầu>`: lập prompt → **cổng duyệt** → thực thi → kiểm thử → báo cáo (`hin-planner`, `hin-executor`, `hin-verifier`).
- `/doi <yêu cầu>`: luồng mở rộng, tái sử dụng `hin-executor` và `hin-verifier`, thêm khâu phân tích, nghiên cứu, rà soát và báo cáo file `.md`.

```
/doi → git status + đọc tài liệu
     → prompt-architect (prompt chuẩn)
     → phân loại: CHỈ-ĐỌC/TÀI-LIỆU, rủi ro thấp → chạy thẳng
                  SỬA-*, rủi ro vừa/cao, thiếu dữ liệu → DỪNG ở cổng "HÃY THỰC THI PROMPT NÀY"
     → analyst ∥ researcher (chỉ đọc)
     → hin-executor → hin-verifier (tối đa 3 vòng)
     → reviewer (chỉ đọc diff)
     → reporter → docs/agent-runs/YYYY-MM-DD-HHmm-<slug>.md
```

Quy tắc đội agent: kiểm tra `git status` trước khi sửa, không ghi đè thay đổi chưa commit; không commit/push/deploy, cài dependency, xóa dữ liệu, migration, sửa bảo mật/production khi chưa hỏi; không bịa kết quả test/build; không chuyển phase khi DoD chưa đạt; không tạo tài liệu trùng; không đưa secret/UUID thật vào file hay log. Dự án không có lint/type-check; kiểm tra thực tế: `npm test`, `npm run build`, `npm run validate`, `node --check`.
