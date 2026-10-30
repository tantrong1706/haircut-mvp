# Quyền riêng tư và cổng phát hành CH Hair Web

Nhánh chuẩn bị: `codex/privacy-readiness`, dựa trên main `89cee9a`.
Đây là checklist kỹ thuật/vận hành, **không phải chứng nhận tuân thủ pháp luật**.
Code/test local không chứng minh website production đã nhận thay đổi.

## Còn cần chủ dự án xác nhận

- Đã đồng ý công khai email hỗ trợ `tantrong1706@gmail.com`.
- Theo xác nhận mới nhất, **chỉ công khai email hỗ trợ**. Chủ dự án rút quyền công khai tên,
  số điện thoại và địa chỉ cá nhân. Gỡ các mặc định này ở Web khách/Manager và tài liệu hiện tại;
  không dùng dữ liệu cá nhân làm fixture demo.
- Tên, số điện thoại và địa chỉ cá nhân: để trống, không yêu cầu địa chỉ nhà riêng
  và không tự điền địa chỉ thay thế. Đây không phải kết luận được miễn mọi nghĩa vụ công bố
  thông tin; cần phân loại hoạt động thực tế và đối chiếu quy định áp dụng trước khi xác nhận tuân thủ.
  Chỉ email hỗ trợ có cấu hình riêng `VITE_PUBLIC_SUPPORT_EMAIL`; không đọc lại các biến liên hệ cá nhân cũ.
  Không bịa mã số thuế, thông tin đăng ký hoặc địa chỉ.
- **Chưa có bằng chứng nguồn/quyền sử dụng:** `customer-web/public/assets/salon-hero.webp`.
  Commit tạo asset `7997a7a` không tự chứng minh có giấy phép. Font Be Vietnam Pro có OFL tại
  `customer-web/public/fonts/OFL.txt`; ảnh do salon tải lên cần quyền sử dụng phù hợp.
- Cần người phụ trách theo dõi inbox, xác minh chủ thể, ghi thời điểm nhận/phản hồi/kết quả và xử lý yêu cầu.
  Link email không tự gửi thư hoặc hoàn tất xóa.
- Lịch lưu từng nhóm dữ liệu, vai trò pháp lý, thỏa thuận với nhà cung cấp, địa điểm xử lý và nghĩa vụ
  tương ứng cần chủ dự án/người tư vấn xác nhận. Không tự bật cron xóa dữ liệu cũ.
- Bản vá dependency/auth ở PR #80/#82 và các thay đổi khác chưa merge/deploy là cổng riêng.
  Không dùng CI của PR khác làm bằng chứng của nhánh này.

## Đối chiếu 20 mục của video

“Có code” chỉ nói về bản chuẩn bị. Lệnh và kết quả thực chạy phải được ghi trong báo cáo TDD.

| #   | Mục                        | Bằng chứng và giới hạn                                                                                                                                                                   |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Quyền riêng tư             | `/privacy`: dữ liệu, mục đích, ảnh nội bộ, dịch vụ kỹ thuật, quyền và liên hệ. Chờ thông tin vận hành/lịch lưu.                                                                          |
| 2   | Điều khoản                 | `/terms`: tài khoản, điểm/quà, trách nhiệm, quyền dữ liệu. Không coi tiếp tục dùng là đồng ý ảnh/thống kê.                                                                               |
| 3   | Cookie                     | `/cookies`: phân biệt phiên/IndexedDB/QR cần thiết và giám sát tùy chọn; lựa chọn tối đa 180 ngày.                                                                                       |
| 4   | Phí/hoàn tiền              | `/service-policy`, `/refund`: chưa nhận thanh toán trong app. Không thêm thu phí hoặc cam kết hoàn tiền giả. Cập nhật trước khi bán gói.                                                 |
| 5   | Tối thiểu dữ liệu          | Phone Auth cho khách; không thêm CCCD/thanh toán/danh bạ. Ảnh không bắt buộc để cộng điểm.                                                                                               |
| 6   | Đồng ý riêng               | Checkbox ảnh mặc định tắt; có nút chỉ dùng thiết yếu và cho phép thống kê độc lập. Không ép thêm checkbox vào mọi form.                                                                  |
| 7   | Thông báo mục đích         | Thông báo ảnh ngay tại check-in, liên kết chính sách; giải thích trước lựa chọn cookie. Thay đổi mục đích cần rà lại.                                                                    |
| 8   | Quyền dữ liệu              | `/data-rights` và link trong tài khoản; email có xác minh. API rút ảnh dùng UID server, không nhận customerId client chọn. Không tự báo xóa xong khi chưa xử lý.                         |
| 9   | Dịch vụ bên thứ ba         | Công khai Firebase/Auth/App Check/reCAPTCHA, Analytics/Performance/Sentry tùy chọn. Định danh giả danh không phải cam kết ẩn danh hoàn toàn.                                             |
| 10  | Quyền dùng ảnh             | Font có OFL; nguồn/quyền ảnh nền và ảnh salon cung cấp còn phải xác minh. “Ảnh AI” không tự chứng minh mọi quyền.                                                                        |
| 11  | Đánh giá không bịa         | Không phát hiện testimonial tĩnh giả trong frontend đã xét. Nội dung salon tự nhập phải được kiểm chứng.                                                                                 |
| 12  | Tuyên bố có căn cứ         | Không phát hiện slogan tĩnh “số 1/tốt nhất” trong phạm vi đã xét. Không sinh chứng nhận/cam kết tuyệt đối.                                                                               |
| 13  | Thông tin vận hành         | Chỉ email hỗ trợ được phép công khai. Tên, điện thoại và địa chỉ cá nhân không hiển thị hoặc lấy lại từ cấu hình cũ; nghĩa vụ công bố thông tin còn phải đối chiếu theo mô hình thực tế. |
| 14  | Mô tả ảnh                  | Ảnh khách/quà đã xét có alt; QR có đường dẫn thay thế cạnh ảnh. Cần rà ngữ cảnh và công nghệ hỗ trợ; alt rỗng chỉ phù hợp khi ảnh thực sự trang trí. Không khẳng định toàn site đã đạt.  |
| 15  | Tương phản                 | Có axe/viewport tests trong phạm vi thực chạy. Không suy ra toàn site đạt WCAG từ vài trang.                                                                                             |
| 16  | Bàn phím/focus             | Cookie dùng bàn phím và trả focus sau chọn; modal có test riêng. Chứng nhận cần kiểm tra công nghệ hỗ trợ/thiết bị thực.                                                                 |
| 17  | Nhãn hành động             | Nút OTP/điểm/ngừng ảnh/link quyền dữ liệu nêu đúng tác dụng. Mở email không bị gọi là đã gửi/xóa xong.                                                                                   |
| 18  | Chặn tracking trước đồng ý | Không init Analytics/Performance/Sentry trước opt-in; rút lại chặn callback chờ và sự kiện mới; không xóa Auth.                                                                          |
| 19  | Pháp luật áp dụng          | Xác định theo hoạt động/thị trường thực tế; không tự áp GDPR/CCPA từ video hoặc chỉ dựa NĐ13 cũ.                                                                                         |
| 20  | Kiểm tra sau cập nhật      | Unit/integration/coverage/E2E trong CI; con người vẫn rà dữ liệu, mục đích, nhà cung cấp, phí và thị trường.                                                                             |

## Lưu trữ, rút quyền và xóa là ba việc khác nhau

- Giám sát chỉ lưu `version`, `optional`, `updatedAt` trên trình duyệt, không kèm UID/SĐT.
  Bản ghi sai/hết hạn/không đọc được mặc định không cấp đồng ý; không đồng bộ lựa chọn giữa các trình duyệt.
- Ảnh có lựa chọn riêng; server lưu quyết định/version/thời điểm. Rút quyền đổi hồ sơ và lượt đang chờ,
  bỏ tham chiếu ảnh chờ, không xóa điểm/quà hoặc viết lại lịch sử hoàn tất.
- API đọc/upload kiểm tra lại consent. URL ký đã cấp còn hiệu lực đến khi hết hạn; không thể thu hồi bản
  đã tải. Ngừng cho phép không phải xóa ảnh tức thì.
- `/delete-account` là hướng dẫn công khai; `/delete-account/manage` giữ luồng quản lý đã xác thực.
  Nhân viên chỉ xóa tài khoản cá nhân, không được yêu cầu xóa salon.
- Yêu cầu xem/sửa/xóa qua hỗ trợ phải được xác minh. Nếu khách tạo lại hồ sơ, chủ salon phải xác nhận
  đúng phiên bản tạo hồ sơ: retry cũ không tự xóa thế hệ mới hoặc báo hoàn tất giả.
- `expiresAt` ở quota chỉ xác định hạn logic, **không chứng minh TTL đã được bật**.
  Phải kiểm tra riêng TTL/log/bản sao lưu trước khi cam kết thời hạn tự xóa.

## Quy trình hỗ trợ tối thiểu

1. Theo dõi email công khai, ghi loại/phạm vi yêu cầu và ngày nhận.
2. Xác minh đúng chủ thể bằng phương thức phù hợp; không đòi mật khẩu/OTP/QR token/ảnh giấy tờ qua email.
3. Phân biệt một salon với toàn hệ thống. Không dùng quyền chủ salon truy cập salon khác.
4. Chỉ xử lý bằng công cụ/quyền được duyệt; theo dõi lỗi một phần/retry, xác minh xong mới báo hoàn tất.
   Không tạo hoặc xóa dữ liệu khách thật để ép test PASS.
5. Phản hồi theo thời hạn pháp luật áp dụng; lưu lý do/ngoại lệ hợp lệ. Trang chính sách không chứng minh
   quy trình hỗ trợ đã thực sự được vận hành.

## Phát hành và rollback

Chưa có quyền merge/deploy đợt này. Khi được phép, cần phối hợp Hosting khách và đúng các API đã đổi:
`checkInWebCustomer`, `withdrawWebCustomerPhotoConsent`, `searchSalonCustomers`,
`getSalonCustomerDetails`, `deleteCustomerData`.
Không deploy toàn bộ Functions/Admin/Rules/TTL/Gateway hoặc đổi quyền tài khoản.
Backend mặc định không cho lưu ảnh nếu client cũ thiếu boolean true. Không nới consent để rollback UI.
Khách dùng UI cũ không có phiên bản hồ sơ phải tải lại trước khi xác nhận xóa một hồ sơ đã được tạo lại.

## Nguồn pháp lý cần đối chiếu

- [Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15](https://vanban.chinhphu.vn/?pageid=27160&docid=214590), hiệu lực 01/01/2026.
- [Nghị định 356/2025/NĐ-CP](https://vanban.chinhphu.vn/?pageid=27160&docid=216387), hiệu lực 01/01/2026.

Xác nhận hiệu lực văn bản không thay thế thẩm định nghĩa vụ cụ thể của CH Hair.
