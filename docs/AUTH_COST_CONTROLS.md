# Đăng nhập và kiểm soát chi phí OTP

Thay đổi chuẩn bị trên nhánh `codex/auth-cost-optimization`. Chưa merge hoặc deploy.

## Bốn hướng và giới hạn

1. **Giữ phiên:** tiếp tục Firebase browser-local persistence trên Auth instance riêng của khách.
   Chờ Auth khôi phục trước khi gửi OTP; đã đăng nhập thì không gửi thêm. Không hứa phiên được
   giữ giữa các trình duyệt, khi xóa dữ liệu hoặc khi tài khoản bị thu hồi.
2. **Dịch vụ SMS:** vẫn dùng Firebase Phone Auth hiện có. Chưa mua dịch vụ, gửi yêu cầu báo giá,
   ký hợp đồng hay tích hợp SMS trong nước. Giảm giá theo sản lượng cần báo giá OTP hiện hành,
   điều kiện tên miền/brandname, thuế và thử giao nhận được chủ dự án cho phép. Không cam kết
   miễn phí vô hạn, không dùng giá quảng cáo làm giá OTP, không mua VPS/điện thoại/SIM.
3. **Chống gửi thừa:** khóa yêu cầu OTP đồng thời và lưu thời điểm thử gửi trong trình duyệt,
   không lưu số điện thoại/OTP vào bộ đệm. Đây chỉ là bảo vệ UX, có thể bị bỏ qua.
   Hook `guardCustomerSms` là đường chặn tại Firebase Auth trước khi gửi, đếm **lượt đặt chỗ gửi**,
   không phải thống kê giao nhận/hóa đơn. Khi bật: chỉ số di động VN, tối đa 3 lượt/số/giờ,
   20 lượt/IP/giờ và 100 lượt/project/ngày UTC theo giá trị mặc định đề xuất. Đây không phải
   hạn mức miễn phí của Google và chưa được áp dụng. Cần chốt ngân sách/hạn mức trước khi bật.
   Hook giữ nguyên kết quả reCAPTCHA, không trả ALLOW, lỗi kho hạn mức thì BLOCK.
   MFA của chủ/nhân viên không đi qua chính sách riêng cho khách này.
4. **Passkey tùy chọn:** chỉ thêm sau Phone OTP còn mới, có xác thực người dùng trên thiết bị;
   giữ nguyên UID Firebase, nên không đổi ID/điểm/lịch sử khách theo salon. OTP vẫn dùng được.
   Mất hoặc gỡ khóa không tạo tài khoản mới. Khi gỡ khóa đang đăng nhập, đăng xuất riêng khách.

## Ranh giới bảo mật passkey

- RP cố định `app.chhaircutsalon.cc`, origin `https://app.chhaircutsalon.cc`; không lấy từ header.
- Dùng SimpleWebAuthn; khóa bí mật ở authenticator, máy chủ chỉ giữ khóa công khai/metadata.
- Challenge ngẫu nhiên có hạn 5 phút, đúng mục đích/UID và tiêu thụ một lần bằng transaction.
- Xác minh chữ ký, origin/RP, user verification, user handle và revision/counter của credential.
- Đăng ký cần Phone Auth trong 5 phút và chưa bị thu hồi theo `tokensValidAfterTime`.
- Mỗi API khách dùng phiên passkey phải kiểm tra lại credential còn active, UID/phone chính xác,
  tài khoản còn tồn tại/chưa bị tắt, thời điểm xác thực/kiểm chứng chưa bị thu hồi, không có quyền
  quản lý ở `users` hoặc `system_admin_access`. Một claim mục đích đơn lẻ không đủ quyền.
- Token custom mang thời điểm kiểm chứng phía máy chủ; không cho đổi token cũ sau thu hồi
  để lấy lại phiên mới. Không chuyển UID hoặc gộp khách bằng số điện thoại do client nhập.
- Tắt cờ chặn các lần đăng ký/đăng nhập passkey mới, vẫn kiểm tra phiên cũ còn hợp lệ để khách
  không bị kẹt. Không rollback bằng cách xóa cầu nối khỏi các API khi còn phiên passkey.
- Collection bắt đầu `_customer_` chỉ máy chủ sử dụng, không mở Rules cho client.
- Hạn mức transport-peer của API passkey là lớp chặn thận trọng: proxy có thể gom nhiều người;
  không được coi IP transport là một người dùng hoặc cơ sở tính phí cho salon.

## Bật thật cần một lần phát hành riêng được cho phép

- Mặc định không bật: `CUSTOMER_PASSKEYS_ENABLED` và `CUSTOMER_SMS_GATE_ENABLED` không bằng `true`;
  các Functions mới được `omit` khỏi deploy discovery. Frontend thiếu
  `VITE_CUSTOMER_PASSKEYS_ENABLED=true` sẽ không hiện nút passkey.
- Passkey: deploy đúng 6 API mới, cầu nối trong 6 API khách đã sửa, App Check hợp lệ và quyền
  ký Firebase custom token tối thiểu. Không tải service-account key vào repo. Sau đó mới bật UI.
- SMS gate: cần Firebase Authentication with Identity Platform và **Auth reCAPTCHA Enterprise**;
  khác với App Check reCAPTCHA đã có. Kiểm tra chi phí/khả năng hỗ trợ trước khi nâng cấp.
  Chỉ bật hook sau khi có phê duyệt project-wide và chốt hạn mức, thử canary có kiểm soát.
- Không xóa hook đã đăng ký mà chưa gỡ đăng ký ở Identity Platform: có thể làm hỏng đăng nhập.
- Thiết lập TTL cho các collection challenge/quota bằng một thay đổi hạ tầng được cho phép;
  logic kiểm tra hết hạn không phụ thuộc TTL. Không bật TTL trên dữ liệu nghiệp vụ.
- Không tự bật App Check enforcement cho API cũ, không deploy toàn bộ Functions hoặc đổi dữ liệu.

## Kiểm thử

`customer-web`: `npm run test:auth:coverage`, `npm run test:auth:browser`, toàn bộ unit/lint/build.
`firebase/functions`: `npm run test:auth:coverage:emulator` phải chạy trong Firestore Emulator
project `demo-*`; integration cũ chạy lại để kiểm tra UID, tenant, QR, điểm và lịch sử.
Browser crypto test dùng Chrome/Pixel ảo; không thay cho kiểm tra passkey trên iPhone/Samsung thật.
Không gửi OTP thật trong bộ test. Giá dịch vụ và số SMS thật không được suy ra từ emulator.
