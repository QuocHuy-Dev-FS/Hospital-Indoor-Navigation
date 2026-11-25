---
name: hospital-nav-workflow
description: Quy trình phối hợp Claude Chat ↔ Antigravity và mẫu prompt thực thi chuẩn cho dự án Hospital Indoor Navigation – Bệnh viện Quân y 7A. Bám docs/WORKFLOW.md và CLAUDE.md.
---

# Skill: hospital-nav-workflow

## Vòng lặp làm việc (từ docs/WORKFLOW.md)

```
(a) CHAT: lập kế hoạch, nghiên cứu, soạn "prompt thực thi"
        │
(b) Người dùng dán prompt vào ANTIGRAVITY → thực thi
        │
(c) CODE: cuối phiên cập nhật PROJECT_STATUS.md + HANDOVER.md
        │
(d) Người dùng chép trạng thái về CHAT → lập prompt tiếp theo
```

---

## Phân vai rõ ràng

| Claude Chat | Claude Code (Antigravity) | Người dùng [USER] |
|---|---|---|
| Bàn ý tưởng, so sánh phương án kèm nguồn | Đọc/sửa file, chạy lệnh, kiểm thử, build, Git | Cung cấp dữ liệu, phê duyệt, khảo sát thực địa |
| Chốt quyết định kiến trúc, soạn prompt | Làm đúng phạm vi, KHÔNG tự mở rộng | Gửi sơ đồ, xác nhận yêu cầu, duyệt commit/deploy |
| KHÔNG sửa repo, KHÔNG thực thi | KHÔNG quyết định kiến trúc mới | Duyệt cài dependency trước |

**Quy ước nhãn trong ROADMAP.md:** `[CHAT]` `[AG]` `[USER]`

---

## Mẫu "prompt thực thi" chuẩn

Khi soạn prompt ở Claude Chat để gửi sang Antigravity, dùng cấu trúc sau:

```
# VAI TRÒ
<Vai trò của Claude Code cho phiên này, 1–2 câu.>

# PHẠM VI
- Phase: <số/tên phase trong ROADMAP.md>
- Bước ROADMAP: <các bước [AG] cần làm, trích nguyên văn>
- NGOÀI phạm vi: <những gì không được làm phiên này>

# BỐI CẢNH
<Quyết định đã chốt ở Chat; liên kết file liên quan; dữ liệu đầu vào cụ thể.>

# QUYẾT ĐỊNH ĐÃ CHỐT
- <Mỗi quyết định kiến trúc/công nghệ đã chốt, kèm lý do ngắn.>

# VIỆC CẦN LÀM (theo thứ tự)
1. ...
2. ...
3. ...

# RÀNG BUỘC
- Không cài dependency / không commit / không push khi chưa được phép (ghi rõ nếu được phép gì).
- Không ghi đè file: <danh sách file cần bảo vệ>.
- Quy ước: ID phòng F<tầng>_R<số>; đơn vị mét; Y lên (glTF).
- Gặp quyết định kiến trúc hoặc yêu cầu mơ hồ → dừng, ghi "Câu hỏi mở" vào ROADMAP.md.

# KIỂM THỬ
- <Lệnh/kiểm tra cụ thể và kết quả mong đợi; không tuyên bố đã test nếu chưa chạy.>

# DEFINITION OF DONE
- [ ] <tiêu chí đo được 1>
- [ ] <tiêu chí đo được 2>

# BÁO CÁO CUỐI
Kết quả / Thay đổi / Kiểm chứng / Còn lại / Tiếp theo.
Cập nhật PROJECT_STATUS.md và HANDOVER.md (kèm mục "Cần mang về Claude Chat bàn").
```

---

## Mẫu báo cáo cuối phiên (Antigravity → Chat)

```
Kết quả: Hoàn thành / Một phần / Chưa
Thay đổi: <file/thành phần cụ thể>
Kiểm chứng: <lệnh đã chạy + kết quả thật; không bịa>
Còn lại: <lỗi, giới hạn, giả định, câu hỏi mở>
Tiếp theo: <bước kế tiếp; việc cần mang về Claude Chat bàn>
```

---

## Checklist đầu phiên (Antigravity)

- [ ] Đọc `ROADMAP.md`, `PROJECT_STATUS.md`, `HANDOVER.md`
- [ ] Kiểm tra `git status`, nhánh hiện tại, thay đổi chưa commit
- [ ] Xác định phase hiện tại và DoD
- [ ] Đối chiếu tài liệu với trạng thái thật trước khi tin một mục là "xong"

---

## Checklist cuối phiên (Antigravity)

- [ ] Cập nhật `PROJECT_STATUS.md` (trạng thái, checkpoint `CP<phase>.<số>`, ngày, bằng chứng)
- [ ] Cập nhật `HANDOVER.md` (đã làm, giả định dùng, lỗi còn lại, câu hỏi mở, "Cần mang về Chat")
- [ ] Báo cáo theo mẫu trên
- [ ] Không commit khi chưa được phép rõ ràng

---

## Quy ước checkpoint

`CP<phase>.<số>` (ví dụ `CP2.1` = tầng mẫu dựng xong).
Ghi vào `PROJECT_STATUS.md` cùng ngày và bằng chứng DoD thật.

---

## Khi gặp quyết định kiến trúc / yêu cầu mơ hồ

1. **DỪNG ngay**, không tự quyết.
2. Ghi vào mục "Câu hỏi mở" của `ROADMAP.md`.
3. Ghi vào mục "Cần mang về Claude Chat bàn" của `HANDOVER.md`.
4. Báo người dùng: `"Câu hỏi mở: <nội dung>. Mang về Claude Chat để bàn."`

---

## Ví dụ câu hỏi mở cần mang về Chat

- Chọn phương án dựng 3D: A (Blender bpy), B (Three.js runtime), hay C (tay)?
- Nền tảng app: native Flutter/React Native hay PWA/WebXR?
- Gốc tọa độ thống nhất: góc nào của tòa nhà?
- Chiều cao tầng thực tế?
- Sai số định vị cho phép chính thức?
- Văn bản pháp luật dữ liệu cá nhân áp dụng?

---

## Tài liệu liên quan

- `CLAUDE.md` – quy tắc bất biến mỗi phiên
- `ROADMAP.md` – kế hoạch và DoD từng phase
- `PROJECT_STATUS.md` – trạng thái hiện tại
- `HANDOVER.md` – bàn giao phiên cuối
- `docs/WORKFLOW.md` – quy trình đầy đủ
