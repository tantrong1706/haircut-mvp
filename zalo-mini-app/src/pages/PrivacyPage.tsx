import { BrandLogo } from "../components/BrandLogo";

export function PrivacyPage() {
  return (
    <section className="privacy-page">
      <header className="page-header">
        <BrandLogo />
        <p className="eyebrow">HAIRCUT</p>
        <h1>Chính sách quyền riêng tư</h1>
        <p className="muted">Cập nhật: 28/06/2026</p>
      </header>

      <div className="panel privacy-content">
        <h2>1. Dữ liệu chúng tôi thu thập</h2>
        <p>
          HAIRCUT có thể lưu tên khách, số điện thoại, 4 số cuối số điện thoại,
          Zalo ID, điểm tích lũy, lịch sử cắt tóc, ghi chú kiểu tóc, quà đã nhận,
          thông tin chủ salon và nhân viên.
        </p>

        <h2>2. Ảnh kiểu tóc</h2>
        <p>
          Ảnh kiểu tóc chỉ được lưu khi khách đồng ý. Nếu khách không đồng ý,
          salon không được chụp hoặc lưu ảnh kiểu tóc của khách.
        </p>

        <h2>3. Mục đích sử dụng</h2>
        <p>
          Dữ liệu được dùng để giúp salon nhận diện khách, lưu lịch sử phục vụ,
          cộng điểm, duyệt điểm, quay thưởng và quản lý mã quà.
        </p>

        <h2>4. Quyền truy cập dữ liệu</h2>
        <p>
          Nhân viên chỉ nên xem thông tin cần thiết như tên khách, 4 số cuối số
          điện thoại, điểm và lịch sử phục vụ liên quan. Chủ salon có quyền quản
          lý cấu hình và duyệt yêu cầu cộng điểm.
        </p>

        <h2>5. Bên thứ ba</h2>
        <p>
          Ứng dụng sử dụng Firebase để lưu trữ dữ liệu và Zalo Mini App để khách
          đăng nhập/xác nhận thông tin. Các dịch vụ này có thể xử lý dữ liệu theo
          chính sách riêng của họ.
        </p>

        <h2>6. Xóa dữ liệu</h2>
        <p>
          Khách có thể yêu cầu salon xóa ảnh kiểu tóc hoặc hồ sơ khách hàng.
          Chủ salon cần xử lý yêu cầu xóa dữ liệu trong thời gian hợp lý.
        </p>

        <h2>7. Liên hệ</h2>
        <p>
          Nếu cần hỗ trợ quyền riêng tư hoặc xóa dữ liệu, vui lòng liên hệ chủ
          salon đang sử dụng HAIRCUT hoặc đội phát triển HAIRCUT.
        </p>
      </div>
    </section>
  );
}
