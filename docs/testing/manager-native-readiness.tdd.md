# Kiểm tra chuẩn bị HAIRCUT Manager cho Android/iOS

Phạm vi: chủ salon và thợ, không thay Customer Web hoặc Admin. Biên dịch không phải
kiểm thử đăng nhập trên điện thoại và không được dùng như bằng chứng đã đủ điều kiện phát hành.

- RED `262a147`: `node --test test/manager-native-readiness.test.mjs` lỗi 2/2 vì đường dẫn
  Swift dùng dấu phân cách Windows và chưa có workflow kiểm tra native.
- GREEN cục bộ: cùng lệnh đạt 2/2 sau khi sửa đường dẫn, đồng bộ bản Swift Package Manager
  với Capacitor iOS 8.4.3 và thêm workflow Android debug/iOS Simulator. YAML phân tích được,
  hai job hiện diện và chỉ có quyền đọc mã. Không gửi gói cài hoặc cấu hình bí mật ra ngoài.
- `npm --prefix apps/manager-mobile run check`: TypeScript, lint, định dạng, 87 test và build
  bundle đạt. Build vẫn có cảnh báo kích thước chunk; đây chưa phải kết quả Gradle/Xcode.
- `node --test test/*.test.mjs`: 156/156 đạt. Hai quy tắc cấu hình mới có kiểm tra hồi quy;
  chưa đo coverage riêng cho YAML hoặc chạy thử thiết bị.

Windows hiện không có Android SDK hoặc Xcode. Gradle/Xcode cần xác minh trên CI của nhánh.
Thử trên Samsung/iPhone cần cấu hình Firebase thử nghiệm đã duyệt và tài khoản demo riêng.
Các yêu cầu ký, quyền riêng tư, thử máy và xét duyệt nằm ở [hồ sơ phát hành](../MANAGER_STORE_SUBMISSION.md).

## Kiểm tra lại 24/11/2026

- [Lượt CI đầu](https://github.com/tantrong1706/haircut-mvp/actions/runs/45190122241):
  Android debug đã biên dịch, kiểm tra Gradle và lint đạt. iOS bị hủy khi chờ cấp máy
  macOS ARM; chưa có bước Xcode nào chạy.
- RED `32adc14`: kiểm tra cấu hình không thấy pool macOS Intel. GREEN cục bộ sau khi
  chuyển sang `macos-15-intel`; giữ Xcode 26.3 và phạm vi biên dịch không ký.
