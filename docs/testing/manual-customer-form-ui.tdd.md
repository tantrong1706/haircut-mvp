# Thử chuẩn hóa biểu mẫu Thêm khách trực tiếp

Phạm vi từ [thang chữ CH Hair Web](web-typography-scale.tdd.md): chỉ biểu mẫu dùng chung ở Chủ salon và Nhân viên, kể cả chế độ thêm vào danh bạ của cùng biểu mẫu. Không cài shadcn/ui hoặc Tailwind.

- Theo mẫu [Card](https://ui.shadcn.com/docs/components/base/card), tách tiêu đề và mô tả, nhóm ô nhập, hàng thao tác. Dùng thang chữ Be Vietnam Pro và màu CH Hair.
- Theo mẫu [Field](https://ui.shadcn.com/docs/components/base/field), ghép nhãn, gợi ý và lỗi với đúng ô nhập. Khi kiểm tra số không đạt, đưa tiêu điểm về ô số; sửa số sẽ bỏ trạng thái lỗi. Lỗi mạng giữ bản nháp, đưa tiêu điểm về nút lưu và không đổ lỗi cho ô nhập.
- Theo mẫu [Button](https://ui.shadcn.com/docs/components/base/button), phân biệt **Tạo lượt chờ** với **Đóng**; có trạng thái đang lưu, khóa chỉnh sửa lúc gửi và giữ vùng bấm. Hai nút xếp dọc khi thẻ hẹp, cùng hàng khi đủ chỗ.
- Không đổi dữ liệu gọi máy chủ, khóa chống gửi trùng, phân quyền, yêu cầu xác nhận điểm hoặc nguyên tắc chỉ lưu ảnh khi khách đồng ý. Số điện thoại vẫn không bắt buộc; không gửi OTP hoặc tự cộng điểm.

## Bằng chứng

- RED `8bd438b`: hai ca Vitest thất bại vì chưa có tiêu đề thẻ và lỗi chưa liên kết với ô số. Bốn ca cũ đạt.
- GREEN `5a9746a`: sáu ca biểu mẫu đạt; bao phủ 97,81% dòng và 89,42% nhánh của `ManualCustomerForm.tsx`. Kiểm tra giữ mã thao tác khi thử lại, từ chối phản hồi thiếu mã lượt và chỉ ghi nhận đồng ý ảnh khi được tích.
- Chủ salon: 65 ca đạt qua 320 px, 360 px, WebKit iPhone, tablet và desktop. Ca Thêm khách trực tiếp thử lỗi ngay tại ô số, Axe, không tràn ngang và tạo lượt chưa cộng điểm. Đã xem ảnh thực tế ở 320 px.
- Nhân viên: 12 ca đạt trên Chromium desktop, Chromium di động và WebKit iPhone. Axe kiểm tra biểu mẫu; dữ liệu gửi chỉ vào điểm nhận giả.
- `npm run check`: lint, định dạng, 416 ca Vitest, TypeScript và bản dựng Web production đều đạt. Không đổi lockfile, API hay cấu hình Firebase.
- Lần chạy đồng thời hai bộ trình duyệt gặp lỗi Vite `504 Outdated Optimize Dep` trên trang thử chủ salon và được dừng. Chạy lại riêng bộ chủ salon đạt 65/65, không bỏ ca kiểm thử.
