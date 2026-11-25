# PRIVACY_SECURITY – Bảo mật và quyền riêng tư

> **Không phải tư vấn pháp lý.** Cần pháp chế bệnh viện xác nhận mọi mục pháp luật.

## 1. Khung pháp lý – CẦN XÁC NHẬN
- Yêu cầu dự án nêu **Nghị định 13/2023/NĐ-CP**.
- Tra cứu ngày 2026-10-23: PwC Việt Nam cho biết **Nghị định 356/2025/NĐ-CP** (hiệu lực 01/01/2026) hướng dẫn Luật Bảo vệ dữ liệu cá nhân 2025 và **thay thế Nghị định 13/2023** (https://www.pwc.com/vn/vn/publications/legal-news-brief/20260128-new-rules-personal-data-protection.html). Chưa đọc toàn văn luật/nghị định.
- Việc cần làm: pháp chế xác nhận văn bản áp dụng; dữ liệu vị trí/y tế có thuộc dữ liệu nhạy cảm không; yêu cầu đồng ý, đánh giá tác động, lưu trữ trong nước (nếu có); quy định riêng của quân y.

## 2. Nguyên tắc thiết kế
1. **Tối thiểu dữ liệu:** định vị và tính đường chạy **trên thiết bị**; không gửi vị trí lên máy chủ nếu không cần.
2. **Không định danh:** không yêu cầu tài khoản/số điện thoại để dùng dẫn đường; không gắn vị trí với hồ sơ bệnh nhân.
3. **Không lưu lịch sử vị trí** định danh. Thống kê (nếu có) chỉ ở dạng tổng hợp, ẩn danh, thời gian lưu giới hạn (**Cần xác nhận**).
4. **Minh bạch:** thông báo rõ mục đích khi xin quyền Bluetooth/vị trí/camera; dùng được ở mức hạn chế khi từ chối quyền (ví dụ chọn thủ công vị trí xuất phát).
5. **Đồng ý:** nếu có thu thập dữ liệu, cần cơ chế đồng ý/rút lại theo luật hiện hành.
6. Camera AR: xử lý tại chỗ, **không ghi/lưu/gửi hình ảnh** (khu vực bệnh viện, bệnh nhân khác có thể lọt vào khung hình).

## 3. Bảo mật hệ thống
- **Secret:** không đưa khóa API/mật khẩu/token vào mã nguồn; dùng biến môi trường/kho bí mật.
- **Admin (Phase 8):** đăng nhập, phân quyền theo vai trò, audit log, hạn chế truy cập mạng.
- **Gói dữ liệu bản đồ:** ký/kiểm hash để chống bị thay đổi (**Cần xác nhận** cơ chế); HTTPS.
- **Beacon:** BLE advertisement có thể bị giả mạo/nghe lén; tránh dựa vào beacon cho quyết định an toàn; xem xét beacon có định danh xoay vòng (**Cần xác nhận**). Không dùng beacon để mở cửa/điều khiển thiết bị.
- **Bản đồ bệnh viện quân y:** có thể là thông tin cần bảo mật. Xác nhận với bệnh viện: phạm vi được hiển thị, khu vực cấm hiển thị, nơi lưu trữ dữ liệu.
- **Dependency:** chỉ thêm khi được duyệt; kiểm tra lỗ hổng trước phát hành; khóa phiên bản.
- **Log:** không ghi vị trí/UUID người dùng; che dữ liệu nhạy cảm.

## 4. An toàn người dùng
- Không đưa tuyến qua vùng cấm, khu vô trùng, khu chỉ nhân viên.
- Luôn có cách quay lại chế độ thủ công (bản đồ + tìm phòng) khi định vị lỗi.
- Hiển thị cảnh báo khi độ tin cậy vị trí thấp.

## 5. Checklist trước triển khai (Phase 10)
- [ ] Pháp chế xác nhận văn bản áp dụng và nghĩa vụ
- [ ] Sơ đồ/dữ liệu dữ liệu được bệnh viện cho phép hiển thị
- [ ] Không lưu vị trí định danh; đã kiểm tra log và mạng (không gửi ngoài ý muốn)
- [ ] Không secret trong repo (quét thủ công/công cụ được duyệt)
- [ ] Quyền ứng dụng tối thiểu; xử lý khi từ chối quyền
- [ ] Admin có đăng nhập, phân quyền, audit log
- [ ] Kế hoạch ứng phó sự cố và người phụ trách
- [ ] Nhân viên được đào tạo
