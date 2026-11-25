# WORKFLOW – Phối hợp Claude Chat ↔ Antigravity

## Vòng lặp

```
(a) CHAT: lập kế hoạch, nghiên cứu, soạn "prompt thực thi"
        │
(b) Người dùng dán prompt vào ANTIGRAVITY (Claude Code) → thực thi
        │
(c) CODE: cuối phiên cập nhật PROJECT_STATUS.md + HANDOVER.md
        │
(d) Người dùng chép trạng thái về CHAT → lập prompt tiếp theo
```

### (a) Ở Claude Chat
- Bàn ý tưởng, so sánh phương án (có nguồn), chốt quyết định.
- Soạn prompt thực thi theo mẫu bên dưới; mỗi prompt chỉ một phạm vi nhỏ, kiểm chứng được.
- Chat **không** sửa repo.

### (b) Ở Antigravity
- Dán prompt. Claude Code đọc `CLAUDE.md`, `ROADMAP.md`, `PROJECT_STATUS.md`, `HANDOVER.md`, làm đúng phạm vi.
- Gặp quyết định kiến trúc/yêu cầu mơ hồ → dừng, ghi "Câu hỏi mở", báo người dùng.
- Xin phép trước khi cài dependency, ghi đè file, commit/push/deploy.

### (c) Cuối phiên
Cập nhật `PROJECT_STATUS.md` (trạng thái, checkpoint) và `HANDOVER.md` (đã làm, giả định, lỗi còn lại, "Cần mang về Claude Chat bàn"). Báo cáo theo mẫu trong `CLAUDE.md`.

### (d) Quay lại Chat
Chép nội dung `PROJECT_STATUS.md` + `HANDOVER.md` (mục cần bàn) vào Chat. Chat dùng đó để lập prompt kế tiếp, không cần giải thích lại.

## Vòng lặp trong Claude Desktop (/hin)

Cách gọi: `/hin <yêu cầu ngắn>` (định nghĩa tại `.claude/commands/hin.md`). Phiên chính là đội trưởng, điều phối 3 subagent trong `.claude/agents/`: `hin-planner`, `hin-executor`, `hin-verifier`. Prompt được lưu tại `docs/prompts/<YYYY-MM-DD>-<slug>.md` (mỗi lần một file mới, không ghi đè).

1. Đọc `CLAUDE.md`, `ROADMAP.md`, `PROJECT_STATUS.md`, `HANDOVER.md`; chạy `git status`.
2. Lập prompt: `hin-planner` soạn prompt thực thi theo mẫu bên dưới.
3. Lưu prompt vào `docs/prompts/`.
4. Cổng duyệt: trình toàn văn prompt, "Cần người dùng quyết" và nguồn, rồi dừng. Chỉ đi tiếp khi người dùng gõ đúng "HÃY THỰC THI PROMPT NÀY"; có góp ý → lập lại prompt, lưu file mới, quay lại bước 4.
5. Thực thi: `hin-executor` làm theo prompt đã duyệt.
6. Kiểm thử: `hin-verifier` kiểm độc lập theo DoD và báo cáo executor.
7. KHÔNG ĐẠT, lỗi trong phạm vi → executor sửa, verifier kiểm lại, tối đa 2 vòng; quá 2 vòng hoặc lỗi ngoài phạm vi → dừng, báo cáo.
8. Đội trưởng cập nhật `PROJECT_STATUS.md` (checkpoint) và `HANDOVER.md`; câu hỏi kiến trúc ghi thêm vào "Câu hỏi mở" của `ROADMAP.md`.
9. Báo cáo: Kết quả / Thay đổi / Kiểm chứng (theo kết luận verifier) / Còn lại / Tiếp theo.

Không bỏ cổng duyệt; không ghi "Hoàn thành" khi verifier chưa kết luận ĐẠT. Vòng lặp Chat ↔ Antigravity ở trên vẫn dùng được song song.

## Mẫu "prompt thực thi" chuẩn

```
# VAI TRÒ
<Vai trò của Claude Code cho phiên này, 1–2 câu.>

# PHẠM VI
- Phase: <số/tên phase trong ROADMAP.md>
- Bước ROADMAP: <các bước [AG] cần làm>
- NGOÀI phạm vi: <những gì không được làm>

# BỐI CẢNH
<Quyết định đã chốt ở Chat; liên kết file liên quan; dữ liệu đầu vào.>

# VIỆC CẦN LÀM (theo thứ tự)
1. ...
2. ...
3. ...

# RÀNG BUỘC
- Không cài dependency / không commit / không push khi chưa được phép (nêu rõ nếu được phép gì).
- Không ghi đè file: <danh sách file có sẵn>.
- Quy ước: ID phòng, hệ tọa độ, đơn vị...
- Gặp quyết định kiến trúc → dừng và ghi "Câu hỏi mở".

# KIỂM THỬ
- <Lệnh/kiểm tra cụ thể và kết quả mong đợi.>

# DEFINITION OF DONE
- [ ] <tiêu chí đo được 1>
- [ ] <tiêu chí đo được 2>

# BÁO CÁO CUỐI
Kết quả / Thay đổi / Kiểm chứng / Còn lại / Tiếp theo.
Cập nhật PROJECT_STATUS.md và HANDOVER.md (kèm mục "Cần mang về Claude Chat bàn").
```

## Quy tắc đặt tên checkpoint
`CP<phase>.<số>` (ví dụ `CP2.1` = tầng mẫu dựng xong). Ghi vào `PROJECT_STATUS.md` cùng ngày và bằng chứng.
