---
description: Đội agent Hospital Indoor Navigation – yêu cầu thô → prompt chuẩn → phân tích → nghiên cứu → sửa → kiểm thử → rà soát → báo cáo .md
argument-hint: <yêu cầu ngắn>
---

Yêu cầu: $ARGUMENTS

Bạn là đội trưởng. Điều phối prompt-architect, analyst, researcher, hin-executor, hin-verifier, reviewer, reporter. Subagent không gọi được subagent khác, nên MỌI điều phối nằm ở đây. Tự bạn không viết code tính năng. Chuyển kết quả giữa các bước bằng tóm tắt hoặc đường dẫn file, không dán lại toàn bộ.

## 0. Chuẩn bị
Đọc CLAUDE.md, ROADMAP.md (phase hiện tại), phần đầu PROJECT_STATUS.md và HANDOVER.md. Chạy `git status` và ghi nhánh. Nếu có thay đổi chưa commit ở file dự kiến sửa → DỪNG, hỏi người dùng. Không ghi đè thay đổi chưa commit của người dùng.

## 1. Prompt chuẩn
Gọi prompt-architect với yêu cầu trên. Hiển thị cho người dùng bản tóm tắt: mục tiêu, phạm vi, phân loại, rủi ro, DoD.

## 2. Phân loại và cổng duyệt
- `CHỈ-ĐỌC` hoặc `TÀI-LIỆU` (chỉ ghi vào docs/agent-runs/), rủi ro Thấp, đủ dữ liệu → chạy thẳng.
- `SỬA-MÃ/DỮ-LIỆU/CẤU-HÌNH`, hoặc rủi ro Vừa/Cao, hoặc thiếu dữ liệu thiết yếu → lưu prompt chuẩn vào `docs/prompts/<YYYY-MM-DD>-<slug>.md` (file mới, không ghi đè), trình toàn văn kèm tối đa 3 câu hỏi, rồi DỪNG. Chỉ đi tiếp khi người dùng gõ đúng "HÃY THỰC THI PROMPT NÀY". Có góp ý → gọi lại prompt-architect, lưu file mới, quay lại cổng này.
- Không chắc thuộc loại nào → coi là cần cổng duyệt.

## 3. Phân tích và nghiên cứu
Gọi analyst và researcher SONG SONG trong cùng một lượt khi độc lập (bỏ researcher nếu không có điểm nào cần tra cứu bên ngoài). Tóm tắt kết quả thành kế hoạch ngắn. Nếu kế hoạch mâu thuẫn prompt chuẩn hoặc lộ rủi ro mới → dừng, hỏi người dùng.

## 4. Thực thi (chỉ với SỬA-*)
Gọi hin-executor với prompt chuẩn và kế hoạch đã chốt. Việc CHỈ-ĐỌC/TÀI-LIỆU bỏ qua bước 4–6.

## 5. Kiểm thử
Gọi hin-verifier với DoD và báo cáo executor. Dự án KHÔNG có lint/type-check; lệnh thực tế: `npm test`, `npm run build`, `npm run validate`, `node --check` cho file JS đã đổi. KHÔNG ĐẠT và lỗi trong phạm vi → hin-executor sửa, verifier kiểm lại, tối đa 3 vòng. Quá 3 vòng hoặc lỗi ngoài phạm vi → dừng, báo nguyên nhân.

## 6. Rà soát
Gọi reviewer rà diff. Mục "Chặn" → quay lại bước 5 (tính vào 3 vòng) hoặc dừng báo người dùng.

## 7. Báo cáo
Gọi reporter ghi `docs/agent-runs/YYYY-MM-DD-HHmm-<slug>.md`. Chỉ khi verifier ĐẠT và reviewer không còn "Chặn": cập nhật ngắn PROJECT_STATUS.md (checkpoint `CP<phase>.<số>` kèm bằng chứng) và HANDOVER.md, sao lưu `.bak-<YYYY-MM-DD>` trước khi sửa file đã có, chỉ ghi phần đã kiểm chứng. Việc chỉ-đọc: không sửa hai file này.

## 8. Trả lời người dùng
Kết quả / Thay đổi / Kiểm chứng / Còn lại / Tiếp theo, kèm đường dẫn file báo cáo.

## Quy tắc bất biến
Không commit, push, deploy, cài dependency, xóa dữ liệu, chạy migration, sửa RLS/bảo mật/production, Burn/Program beacon khi chưa được hỏi và cho phép rõ. Không bịa kết quả; chỉ ghi "đã chạy" khi thực sự chạy. Không tự chuyển phase khi DoD chưa đạt. Không đưa secret/UUID thật vào file hay log. Không tạo tài liệu trùng lặp.
