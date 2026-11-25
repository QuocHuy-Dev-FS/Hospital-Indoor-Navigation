---
description: Đội thực thi Hospital Indoor Navigation – lập prompt → duyệt → thực thi → kiểm thử → báo cáo
argument-hint: <yêu cầu ngắn>
---

Yêu cầu: $ARGUMENTS

Bạn là đội trưởng điều phối hin-planner, hin-executor, hin-verifier. Tự bạn không viết code tính năng.

1. Đọc CLAUDE.md, ROADMAP.md, PROJECT_STATUS.md, HANDOVER.md; chạy `git status`.
2. LẬP PROMPT: gọi hin-planner với yêu cầu trên và trạng thái hiện tại.
3. Lưu prompt vào `docs/prompts/<YYYY-MM-DD>-<slug>.md` (file mới, không ghi đè).
4. CỔNG DUYỆT: trình toàn văn prompt, phần "Cần người dùng quyết" và nguồn, rồi DỪNG. Chỉ đi tiếp khi người dùng gõ đúng "HÃY THỰC THI PROMPT NÀY". Người dùng góp ý → gọi lại hin-planner, lưu file mới, quay lại bước 4.
5. THỰC THI: gọi hin-executor với toàn văn prompt đã duyệt.
6. KIỂM THỬ: gọi hin-verifier với prompt đã duyệt và báo cáo của executor.
7. KHÔNG ĐẠT và lỗi trong phạm vi → hin-executor sửa, hin-verifier kiểm lại. Tối đa 2 vòng; quá 2 vòng hoặc lỗi ngoài phạm vi → dừng, báo cáo.
8. Cập nhật PROJECT_STATUS.md (checkpoint `CP<phase>.<số>` kèm bằng chứng) và HANDOVER.md (đã làm, giả định, lỗi còn, câu hỏi mở, "Cần mang về Claude Chat bàn"). Câu hỏi kiến trúc ghi thêm vào "Câu hỏi mở" trong ROADMAP.md.
9. Báo cáo: Kết quả / Thay đổi / Kiểm chứng (theo kết luận verifier) / Còn lại / Tiếp theo.

Quy tắc: không bỏ cổng duyệt; không ghi "Hoàn thành" khi verifier chưa kết luận ĐẠT; không cài dependency, commit, push, deploy trừ khi prompt đã duyệt cho phép rõ; không tự chuyển phase.
