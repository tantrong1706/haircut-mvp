import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { PublicContact } from "../components/PublicContact";

type Props = {
  onBack?: () => void;
  onNavigate?: (page: "privacy" | "terms") => void;
};

export function PrivacyPage({ onBack, onNavigate }: Props = {}) {

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
        <p className="eyebrow">CH Haircut Salon</p>
        <h1>Chính sách quyền riêng tư</h1>
        <p className="muted">Cập nhật: 30/10/2026</p>
      </header>

      <div className="panel privacy-content">
        <h2>1. Đơn vị quản lý dữ liệu</h2>
        <p>
          Salon mà khách check-in là đơn vị quản lý dữ liệu phục vụ của khách. Tên salon và chi
          nhánh được hiển thị trước khi khách xác nhận tạo lượt cắt; CH Haircut Salon cung cấp hệ
          thống kỹ thuật để salon vận hành dữ liệu đó.
        </p>

        <h2>2. Dữ liệu được thu thập</h2>
        <p>
          CH Haircut Salon dùng số điện thoại do khách nhập và xác thực bằng OTP qua Firebase
          Authentication để đăng nhập. Mã tài khoản Firebase giúp khách xem lại dữ liệu của mình;
          phiên đăng nhập được lưu trên trình duyệt cho đến khi đăng xuất hoặc phiên không còn hợp
          lệ. Ứng dụng Web không yêu cầu tài khoản hoặc quyền truy cập Zalo. Hệ thống còn xử lý
          salon, chi nhánh và thời điểm check-in; điểm, lịch sử cắt tóc, ghi chú dịch vụ, lượt quay
          và mã quà. Với chủ salon và nhân viên, hệ thống lưu email đăng nhập, tên, vai trò và chi
          nhánh được phân công.
        </p>

        <h2 id="photo-consent">3. Ảnh kiểu tóc và sự đồng ý</h2>
        <p>
          Quyền lưu ảnh là lựa chọn riêng, mặc định không chọn. Khách vẫn được yêu cầu tích điểm
          khi không cho lưu ảnh. Nếu chọn cho phép, nhân viên có thể chụp và lưu tối đa 3 ảnh cho
          lượt phục vụ đó. Ảnh và ghi chú chỉ dành cho chủ salon và nhân viên được phân quyền;
          trang khách hiển thị ngày cắt và điểm đã cộng. Khách có thể ngừng cho phép ảnh hoặc yêu cầu
          xóa theo mục 8; việc này không đồng nghĩa xóa điểm hoặc tài khoản.
        </p>

        <h2>4. Mục đích sử dụng</h2>
        <p>
          Dữ liệu chỉ được dùng để xác nhận khách tại đúng chi nhánh, ghi nhận lần phục vụ, hỗ trợ
          salon phục vụ đúng nhu cầu, cộng điểm, quay thưởng, đổi quà, xử lý yêu cầu hỗ trợ và bảo
          vệ hệ thống trước hành vi lạm dụng.
        </p>

        <h2>5. Phạm vi salon và chi nhánh</h2>
        <p>
          Hồ sơ khách và điểm được dùng chung trong cùng một salon. Hàng chờ, lượt cắt, nhân viên và
          báo cáo vận hành gắn với từng chi nhánh; nhân viên chỉ nhận phần thông tin tối thiểu của
          khách tại chi nhánh được phân công, còn chủ salon quản lý dữ liệu thuộc salon của mình.
        </p>

        <h2>6. Dịch vụ kỹ thuật</h2>
        <p>
          Ứng dụng dùng Firebase Authentication, Firestore, Storage, Functions và Hosting để đăng
          nhập, xử lý và lưu dữ liệu. App Check và reCAPTCHA phục vụ xác minh, chống lạm dụng.
          Google Analytics, Firebase Performance và Sentry là giám sát tùy chọn, chỉ khởi tạo sau
          khi khách chủ động cho phép. Các sự kiện có thể gồm định danh kỹ thuật của tài khoản,
          salon, chi nhánh và trạng thái thao tác; đây không phải cam kết ẩn danh hoàn toàn.
          Ứng dụng lọc token, mã xác minh, số điện thoại, email, ghi chú và URL ảnh khỏi telemetry.
          Khách có thể từ chối hoặc đổi lựa chọn tại cài đặt quyền riêng tư mà không mất quyền tích điểm.
        </p>

        <h2>7. Thời hạn lưu và bảo vệ dữ liệu</h2>
        <p>
          Hồ sơ, điểm, lịch sử và ảnh/ghi chú đã lưu được giữ lâu dài khi salon còn cần để phục vụ
          khách; không tự xóa chỉ vì khách lâu không ghé. Việc lưu giữ vẫn có thể kết thúc khi có
          yêu cầu xóa hợp lệ, hết mục đích xử lý hoặc salon ngừng sử dụng dịch vụ. Thời hạn của
          OTP, liên kết ảnh và dữ liệu tải lên tạm không phải thời hạn lưu hồ sơ đã hoàn tất.
          Dữ liệu được bảo vệ bằng
          đăng nhập, phân quyền theo salon/chi nhánh, token QR có thể xoay và quy tắc truy cập
          Firebase; không có phương thức truyền hoặc lưu trữ nào bảo đảm an toàn tuyệt đối.
        </p>

        <h2 id="data-rights">8. Quyền xem, sửa và xóa dữ liệu</h2>
        <p>
          Khách có thể yêu cầu xem, sửa hoặc xóa hồ sơ và ảnh bằng cách liên hệ salon đã phục vụ
          hoặc kênh hỗ trợ bên dưới. Yêu cầu sẽ được xác minh để tránh cung cấp hoặc xóa nhầm;
          đơn vị vận hành phản hồi và xử lý theo thời hạn pháp luật áp dụng, giải thích phạm vi
          hoặc ngoại lệ lưu giữ nếu có. Khách không cần tài khoản quản lý để gửi yêu cầu.
        </p>

        <h2>9. Liên hệ</h2>
        <PublicContact />
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
            Đọc Điều khoản sử dụng của CH Haircut Salon
          </a>
          {onNavigate ? null : (
            <>
              <br />
              <a href="/data-rights">Yêu cầu xem, sửa hoặc xóa dữ liệu</a>
              <br /><a href="/cookies">Cookie và lựa chọn giám sát</a>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
