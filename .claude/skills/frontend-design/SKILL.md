# Frontend Design Skill

*Nguồn: github.com/anthropics/skills/skills/frontend-design — Apache 2.0*

## Nguyên tắc cốt lõi

**Thiết kế gắn với bối cảnh sản phẩm.** Trước khi chọn màu, font, bố cục — xác định ngành, đối tượng, chức năng chính. "Ngành, chủ đề, vật liệu và ngôn ngữ đặc thù của sản phẩm là nơi lựa chọn thị giác mang bản sắc riêng bắt nguồn từ đó."

**Typography có chủ đích.** Chọn typeface phù hợp với dự án, không dùng bộ font mặc định quen tay. Giữ dòng chữ dưới 80 ký tự. Tránh nhấn mạnh một từ đơn lẻ trong tiêu đề.

**Cấu trúc thị giác truyền thông tin.** Đường kẻ, viền, số thứ tự, divider, nhãn — những yếu tố này mã hóa nội dung, không chỉ để trang trí.

## Các mẫu thiết kế chung cần tránh

Năm dấu hiệu của thiết kế "AI tạo ra":
- Nền kem ấm + serif display + nhấn màu terracotta
- Nền tối + nhấn màu acid-green hoặc vermilion sáng
- Bố cục báo lớn + đường kẻ mỏng hairline
- Bộ thẻ SaaS góc bo đều nhau
- Chrome mẫu (tracked caps, dấu giữa, nhãn monospace)

## Quy trình hai bước

1. **Lập kế hoạch thiết kế ngắn gọn**: màu, font, bố cục, nguyên tắc. Đối chiếu với brief trước khi viết code.
2. **Xây dựng**: dùng sự táo bạo ở một điểm nổi bật. Cắt bỏ trang trí không phục vụ brief.

## Chữ trong thiết kế

Chữ xuất hiện vì một lý do: giúp người dùng hiểu và dùng được sản phẩm. Giọng chủ động, ngôn ngữ đơn giản, phù hợp đối tượng và thương hiệu.

## Áp dụng cho Hospital Indoor Navigation

**Bối cảnh:** Môi trường y tế, người dùng bao gồm người cao tuổi, bệnh nhân xe lăn, người nhà — nhiều lần căng thẳng, cần tìm đường nhanh.

**Nguyên tắc thiết kế dự án này:**
- Rõ ràng > Đẹp: thông tin luôn thắng thẩm mỹ
- Tiếp cận được (accessible): WCAG AA tối thiểu, chữ ≥ 18px base, vùng chạm ≥ 48px
- Nhất quán và đáng tin: không hiệu ứng phô trương, tôn trọng prefers-reduced-motion
- Tiếng Việt đúng dấu, câu đơn giản
- Không dùng CDN bên ngoài cho font/icon
