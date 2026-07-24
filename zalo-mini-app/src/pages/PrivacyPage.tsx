import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";

type Props = {
  onBack?: () => void;
  onNavigate?: (page: "privacy" | "terms") => void;
};

export function PrivacyPage({ onBack, onNavigate }: Props = {}) {
  const supportEmail = String(import.meta.env.VITE_SUPPORT_EMAIL || "").trim();
  const supportPhone = String(import.meta.env.VITE_SUPPORT_PHONE || "").trim();

  return (
    <section className="privacy-page">
      <header className="page-header">
        {onBack ? (
          <button type="button" className="secondary-button legal-back-button" onClick={onBack}>
            <ArrowLeft size={18} aria-hidden="true" />
            Quay lại
          </button>
        ) : null}
        <BrandLogo />
        <p className="eyebrow">HAIRCUT</p>
        <h1>Chính sách quyền riêng tư</h1>
        <p className="muted">Cập nhật: 18/07/2026</p>
      </header>

      <div className="panel privacy-content">
        <h2>1. Đơn vị quản lý dữ liệu</h2>
        <p>
          Salon mà khách check-in là đơn vị quản lý dữ liệu phục vụ của khách. Tên salon và chi
          nhánh được hiển thị trước khi khách xác nhận tạo lượt cắt; HAIRCUT cung cấp hệ thống kỹ
          thuật để salon vận hành dữ liệu đó.
        </p>

        <h2>2. Dữ liệu được thu thập</h2>
        <p>
          HAIRCUT xử lý mã định danh và tên hiển thị Zalo sau khi khách cho phép. Ảnh đại diện Zalo
          chỉ được hiển thị tạm trên màn hình xác nhận và không được lưu vào hồ sơ phục vụ. Số điện
          thoại chỉ được lưu khi khách tự nhập; ứng dụng không yêu cầu quyền lấy số điện thoại Zalo.
          Hệ thống còn xử lý salon, chi nhánh và thời điểm check-in; điểm, lịch sử cắt tóc, ghi chú
          dịch vụ, lượt quay và mã quà. Với chủ salon và nhân viên, hệ thống lưu email đăng nhập,
          tên, vai trò và chi nhánh được phân công.
        </p>

        <h2>3. Ảnh kiểu tóc và sự đồng ý</h2>
        <p>
          Ảnh chỉ được tải lên khi khách chủ động đồng ý lưu ảnh kiểu tóc. Khách có thể tắt lựa chọn
          này ở lần check-in tiếp theo hoặc yêu cầu salon dừng chụp; việc tắt đồng ý ngăn ảnh mới,
          còn ảnh cũ có thể được yêu cầu xóa theo mục 8.
        </p>

        <h2>4. Mục đích sử dụng</h2>
        <p>
          Dữ liệu chỉ được dùng để xác nhận khách tại đúng chi nhánh, quản lý hàng chờ và lượt cắt,
          hỗ trợ salon phục vụ đúng nhu cầu, cộng điểm, quay thưởng, đổi quà, xử lý yêu cầu hỗ trợ
          và bảo vệ hệ thống trước hành vi lạm dụng.
        </p>

        <h2>5. Phạm vi salon và chi nhánh</h2>
        <p>
          Hồ sơ khách và điểm được dùng chung trong cùng một salon. Hàng chờ, lượt cắt, nhân viên và
          báo cáo vận hành gắn với từng chi nhánh; nhân viên chỉ nhận phần thông tin tối thiểu của
          khách tại chi nhánh được phân công, còn chủ salon quản lý dữ liệu thuộc salon của mình.
        </p>

        <h2>6. Dịch vụ kỹ thuật</h2>
        <p>
          Ứng dụng dùng Zalo Mini App để xác minh khách và dùng Firebase Authentication, Firestore,
          Storage, Functions và Hosting để đăng nhập, xử lý và lưu dữ liệu. Google Analytics và
          Sentry chỉ xử lý sự kiện kỹ thuật đã loại dữ liệu nhạy cảm khi các dịch vụ này được bật;
          HAIRCUT không gửi QR token, access token hay mã xác minh bí mật vào telemetry.
        </p>

        <h2>7. Thời hạn lưu và bảo vệ dữ liệu</h2>
        <p>
          Dữ liệu vận hành được giữ khi salon còn cần để cung cấp chương trình chăm sóc khách, cho
          đến khi có yêu cầu xóa hợp lệ hoặc salon ngừng sử dụng dịch vụ. Dữ liệu được bảo vệ bằng
          đăng nhập, phân quyền theo salon/chi nhánh, token QR có thể xoay và quy tắc truy cập
          Firebase; không có phương thức truyền hoặc lưu trữ nào bảo đảm an toàn tuyệt đối.
        </p>

        <h2 id="data-rights">8. Quyền xem, sửa và xóa dữ liệu</h2>
        <p>
          Khách có thể yêu cầu xem, sửa hoặc xóa hồ sơ và ảnh bằng cách liên hệ salon đã phục vụ
          hoặc kênh hỗ trợ bên dưới. Yêu cầu sẽ được xác minh để tránh xóa nhầm, dự kiến phản hồi
          trong 7 ngày làm việc và hoàn tất trong tối đa 30 ngày, trừ khi pháp luật yêu cầu lưu lâu
          hơn.
        </p>

        <h2>9. Liên hệ</h2>
        <p>
          {supportEmail ? (
            <>
              Email hỗ trợ: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            </>
          ) : (
            <>Khách vui lòng liên hệ trực tiếp salon đã hiển thị khi check-in.</>
          )}
          {supportPhone ? (
            <>
              <br />
              Điện thoại hỗ trợ: <a href={`tel:${supportPhone}`}>{supportPhone}</a>
            </>
          ) : null}
        </p>
        <p>
          <a
            href={onNavigate ? "#terms" : "/terms"}
            onClick={(event) => {
              if (onNavigate) {
                event.preventDefault();
                onNavigate("terms");
              }
            }}
          >
            Đọc Điều khoản sử dụng của HAIRCUT
          </a>
          {onNavigate ? null : (
            <>
              <br />
              <a href="/delete-account">Yêu cầu xóa tài khoản hoặc salon</a>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
