# Prompt chuẩn – Commit đầu tiên và push lên GitHub (2026-11-12)

**Phân loại:** SỬA-CẤU-HÌNH (thao tác Git, ra bên ngoài) · **Rủi ro:** Cao (push lên GitHub là công bố ra ngoài, khó thu hồi) · **Cổng duyệt:** bắt buộc.

## Hiện trạng đã kiểm (2026-11-12)

- Nhánh cục bộ: `master`, **chưa có commit nào**. Không có nhánh nào khác, không có stash, không có worktree phụ → **không có gì để gộp nhánh**.
- Remote `origin` = `https://github.com/QuocHuy-Dev-FS/Hospital-Indoor-Navigation.git`; `git ls-remote` thành công và **remote trống** (chưa có nhánh nào).
- Nhánh chính theo cấu hình ứng dụng: `main`; `init.defaultBranch` cục bộ = `master`.
- `git add -A --dry-run`: 230 file, khoảng 12,8 MB; file lớn nhất khoảng 1,9 MB (PDF datasheet).
- File thật bị ignore đúng: `data/beacons.local.json`, `data/beacon-map.local.json`, `.claude/settings.local.json`, `allowlist.json`, `bench/measurements/*.csv`, `assets/floorplans/*`.
- Quét UUID: chỉ thấy giá trị mẫu/placeholder (`00000000-…`, `00000001-…`, `abcd1234-…`, `aaaa…`, `bbbb…`) và tiền tố `fef3b5fd-…` trong `tools/beacon_bridge/` (dạng ví dụ trong code/test). Không thấy chuỗi giống khóa API/mật khẩu/token.

## Điểm cần người dùng quyết

1. **Dữ liệu bệnh viện có thể chưa được phép công bố nhưng KHÔNG bị ignore:** `assets/models/*.glb` (6 mô hình 3D dựng từ sơ đồ tầng 1, trong khi chính sơ đồ gốc `assets/floorplans/*` bị ignore vì "chưa được phép công bố"), `data/survey/photo_findings.json`, `data/nodes.json`/`rooms.json`… (bố trí phòng), `public/brand/quan-y-7a-*.jpg` (logo/ảnh bệnh viện). Repo GitHub là public hay private?
2. **File `.bak-*`** (khoảng 25 file sao lưu ở thư mục gốc, ví dụ `index.html.bak-2026-11-11`): commit cùng, hay thêm `*.bak-*` vào `.gitignore` trước?
3. **Tên nhánh push:** đổi `master` → `main` (khớp nhánh chính) rồi push `main`, hay giữ `master`?

## Các bước thực thi (sau khi duyệt)

1. Áp dụng các quyết định 1–2 (nếu có): chỉ sửa `.gitignore` (sao lưu `.gitignore.bak-2026-11-12` trước khi sửa), không xóa file nào trên đĩa.
2. `git add -A`, rồi đối chiếu `git status` và danh sách file đã stage: không có `*.local.json`, `.env*`, `allowlist.json`, `measurements/*.csv`, `settings.local.json`, `node_modules/`, `dist/`.
3. Quét lại UUID/secret trên nội dung đã stage (`git diff --cached`), chỉ chấp nhận placeholder.
4. Chạy `npm test`, `npm run build`, `npm run validate` và ghi kết quả thật (không chặn commit nếu lỗi có từ trước, nhưng phải báo).
5. Đổi tên nhánh nếu được chọn: `git branch -M main`.
6. Commit: `chore: commit đầu tiên – khung dự án Hospital Indoor Navigation` (kèm dòng Co-Authored-By).
7. `git push -u origin <nhánh>`. Không dùng `--force`.
8. Kiểm chứng: `git ls-remote origin` thấy nhánh đúng và hash trùng `git rev-parse HEAD`.

## DoD

- Có đúng 1 commit trên nhánh đã chọn; remote có nhánh đó, hash khớp HEAD.
- Không file nhạy cảm nào trong commit (đã kiểm theo bước 2–3).
- Kết quả test/build/validate được ghi thật vào báo cáo.

## Ngoài phạm vi

Không sửa mã sản phẩm, không chuyển phase, không tạo PR, không deploy, không force push, không xóa file.
