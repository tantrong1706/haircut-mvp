import { BrandLogo } from "../components/BrandLogo";

export function TermsPage() {
  const supportEmail = String(import.meta.env.VITE_SUPPORT_EMAIL || "").trim();
  const supportPhone = String(import.meta.env.VITE_SUPPORT_PHONE || "").trim();

  return (
    <section className="privacy-page">
      <header className="page-header">
        <BrandLogo />
        <p className="eyebrow">HAIRCUT</p>
        <h1>Điều khoản sử dụng</h1>
        <p className="muted">Cập nhật: 15/07/2026</p>
      </header>

      <div className="panel privacy-content">
        <h2>1. Phạm vi dịch vụ</h2>
        <p>
          HAIRCUT hỗ trợ salon quản lý chi nhánh, hàng chờ, lịch sử phục vụ, điểm chăm sóc khách
          hàng, vòng quay và mã quà. Khách truy cập bằng QR salon hoặc QR chi nhánh; chủ salon và
          nhân viên sử dụng tài khoản được phân quyền riêng.
        </p>

        <h2>2. Xác nhận và tài khoản</h2>
        <p>
          Khách chịu trách nhiệm xác nhận đúng salon, chi nhánh và thông tin hiển thị trước khi tạo
          lượt. Chủ salon và nhân viên phải bảo vệ tài khoản đăng nhập, không chia sẻ quyền truy cập
          và thông báo ngay khi nghi ngờ tài khoản bị sử dụng trái phép.
        </p>

        <h2>3. Quy tắc sử dụng</h2>
        <p>
          Người dùng không được tạo lượt giả, tự cộng điểm, giả mạo khách hoặc nhân viên, khai thác
          lỗi, can thiệp QR, mã quà hay truy cập dữ liệu của salon khác. HAIRCUT có thể giới hạn
          hoặc khóa tài khoản khi phát hiện hành vi gây hại, gian lận hoặc vi phạm pháp luật.
        </p>

        <h2>4. Điểm, vòng quay và quà</h2>
        <p>
          Điểm và quà là chương trình chăm sóc khách do từng salon cấu hình, không phải tiền, không
          chuyển nhượng và không quy đổi thành tiền mặt. Salon chịu trách nhiệm công bố điều kiện,
          thời hạn và thực hiện phần thưởng đã cung cấp cho khách.
        </p>

        <h2>5. Ảnh và ghi chú phục vụ</h2>
        <p>
          Nhân viên chỉ được lưu ảnh kiểu tóc khi khách đã đồng ý. Ghi chú và ảnh phải phục vụ trực
          tiếp cho lần cắt tóc, không được dùng cho mục đích khác hoặc chứa nội dung không phù hợp.
        </p>

        <h2>6. Dữ liệu cá nhân</h2>
        <p>
          Việc thu thập, sử dụng, bảo vệ và xóa dữ liệu được mô tả tại{" "}
          <a href="/privacy">Chính sách quyền riêng tư</a>. Khi khách rút lại đồng ý hoặc gửi yêu
          cầu xóa hợp lệ qua Zalo, hệ thống sẽ tiếp nhận và xử lý dữ liệu liên quan theo quy trình
          bảo mật của HAIRCUT.
        </p>

        <h2>7. Tính sẵn sàng của dịch vụ</h2>
        <p>
          HAIRCUT cố gắng duy trì dịch vụ ổn định nhưng có thể tạm gián đoạn do bảo trì, kết nối
          mạng, Zalo, Firebase hoặc sự kiện ngoài khả năng kiểm soát. Các thay đổi quan trọng sẽ
          được triển khai theo hướng bảo vệ dữ liệu và hạn chế ảnh hưởng tới hoạt động salon.
        </p>

        <h2>8. Trách nhiệm</h2>
        <p>
          Salon chịu trách nhiệm về dịch vụ cắt tóc, nội dung ghi chú, chương trình điểm và việc
          thực hiện quà. HAIRCUT cung cấp nền tảng kỹ thuật và không thay thế thỏa thuận dịch vụ
          trực tiếp giữa salon với khách hàng.
        </p>

        <h2>9. Thay đổi điều khoản</h2>
        <p>
          Điều khoản có thể được cập nhật khi chức năng hoặc quy định pháp luật thay đổi. Phiên bản
          hiện hành và ngày cập nhật luôn được công bố tại trang này; việc tiếp tục sử dụng sau khi
          điều khoản có hiệu lực được xem là chấp nhận nội dung cập nhật.
        </p>

        <h2>10. Liên hệ</h2>
        <p>
          {supportEmail ? (
            <>
              Email hỗ trợ: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            </>
          ) : (
            <>Vui lòng liên hệ salon đang sử dụng HAIRCUT.</>
          )}
          {supportPhone ? (
            <>
              <br />
              Điện thoại hỗ trợ: <a href={`tel:${supportPhone}`}>{supportPhone}</a>
            </>
          ) : null}
        </p>
        <p>
          <a href="/privacy">Chính sách quyền riêng tư</a>
          <br />
          <a href="/delete-account">Yêu cầu xóa tài khoản hoặc salon</a>
        </p>
      </div>
    </section>
  );
}
