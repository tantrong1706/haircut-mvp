# Thang chữ CH Hair Web

Áp dụng cho Web Khách hàng, Chủ salon và Nhân viên. Giữ giao diện tối, màu thương hiệu, luồng đăng nhập và nghiệp vụ. Không thêm dependency, máy chủ phông hay thay đổi API.

- [TypoScale](https://github.com/bilalmlkdev/typoscale) là tham chiếu cho thang chữ co giãn. Dùng biến CSS theo vai trò tại `customer-web/src/styles/typography.css`, không đưa công cụ vào ứng dụng.
- Giữ [Be Vietnam Pro](https://github.com/bettergui/BeVietnamPro) WOFF2 sẵn có, có dải Latin và tiếng Việt. Tiêu đề khách dùng nét 300, nội dung thường 400, tiêu đề quản lý 500. Khai báo phông dùng chung cho Web.
- Cỡ mặc định: chú thích 12 px, nhãn/nút 14 px, nội dung và ô nhập 16 px, tiêu đề phần 18–20 px. Tiêu đề trang 28–36 px. Các mốc dùng `rem` để đáp ứng cài đặt cỡ chữ. Các chữ trang trí và số điểm lớn vẫn giữ vai trò riêng.

## Kiểm thử

- RED `b7dcbab`: hai ca Chromium chạy và thất bại như dự kiến. Tiêu đề khách tại 320 px là 31 px và tiêu đề quản lý tại 360 px là 32 px, chưa theo thang mới.
- GREEN: `npm run build:test` và `npm run test:e2e:run -- web-barber.spec.ts` đạt 12/12 ca trên Chromium desktop, Chromium di động và WebKit iPhone. Kiểm tra cỡ chữ, phông tiếng Việt, cỡ chữ 125%, tràn ngang và luồng OTP/tích điểm với dữ liệu giả. Không chạy thao tác ghi trên production.
- Hồi quy: `npm run check` đạt lint, định dạng, 415 ca Vitest và bản dựng production (gồm TypeScript). `npm run test:e2e:run` đạt 90 ca, đã bao gồm 12 ca nêu trên; `npm run test:owner:browser` đạt 65 ca, `npm run test:returning:browser` đạt 12 ca. Đã xem ảnh màn hình đăng nhập và thẻ duyệt điểm ở 320 px.
- Không đổi lockfile. `npm audit --omit=dev` báo 0 cảnh báo trong phụ thuộc chạy production; `npm ci` vẫn báo 43 cảnh báo khi tính cả bộ công cụ phát triển có sẵn, ngoài phạm vi thay đổi kiểu chữ.
- Thay đổi là CSS; kiểm thử đọc kiểu hiển thị thực tế của trình duyệt, không suy ra tỷ lệ coverage CSS từ Vitest.

## Mẫu thử tiếp theo: tham khảo shadcn/ui

Đã thử trên [biểu mẫu **Thêm khách trực tiếp**](manual-customer-form-ui.tdd.md) trước khi áp dụng toàn Web. Tái sử dụng CSS và màu CH Hair, không cần cài Tailwind hay chuyển toàn bộ bộ giao diện.

- [Button](https://ui.shadcn.com/docs/components/base/button): phân biệt thao tác chính, phụ và nguy hiểm; chuẩn hóa trạng thái focus, đang xử lý, vô hiệu hóa. Giữ vùng bấm hiện có trên điện thoại.
- [Card](https://ui.shadcn.com/docs/components/base/card): thống nhất bố cục tiêu đề, nội dung, nút ở cuối. Giữ thẻ điểm thành viên là trường hợp có nhận diện riêng.
- [Field](https://ui.shadcn.com/docs/components/base/field): thống nhất nhãn, gợi ý, lỗi và liên kết chúng với ô nhập. Giữ nguyên xác thực, đồng ý lưu ảnh và yêu cầu xác nhận điểm.
