import { BrandLogo } from "../components/BrandLogo";
import { PublicContact } from "../components/PublicContact";
import { publicContact } from "../config/publicContact";
import { PRIVACY_PREFERENCES_EVENT } from "../services/privacyPreferences";

type Kind = "cookies" | "data-rights" | "service";
const titles: Record<Kind, string> = {
  cookies: "Cookie và lưu trữ trên thiết bị",
  "data-rights": "Quyền dữ liệu của bạn",
  service: "Chính sách dịch vụ",
};

export function LegalInfoPage({ kind }: { kind: Kind }) {
  const email = publicContact().email;
  function requestLink(subject: string) {
    return `mailto:${email}?subject=${encodeURIComponent(`CH Hair - ${subject}`)}`;
  }
  return (
    <section className="privacy-page">
      <header className="page-header">
        <BrandLogo />
        <h1>{titles[kind]}</h1>
        <p className="muted">Cập nhật: 29/10/2026</p>
      </header>
      <div className="panel privacy-content">
        {kind === "cookies" && (
          <>
            <h2>Thiết yếu để sử dụng ứng dụng</h2>
            <p>
              Firebase Authentication có thể dùng IndexedDB và bộ nhớ trình duyệt để giữ phiên đăng
              nhập. Ứng dụng nhớ salon gần nhất và tạm giữ ngữ cảnh QR để khôi phục thao tác đăng
              nhập. App Check và reCAPTCHA phục vụ xác minh, chống lạm dụng. Không tắt các biện pháp
              bảo vệ này khi bạn từ chối thống kê.
            </p>
            <h2>Thống kê và giám sát tùy chọn</h2>
            <p>
              Google Analytics, Firebase Performance và Sentry chỉ được khởi tạo khi bạn chủ động
              cho phép. Việc từ chối không chặn đăng nhập, tích điểm, lịch sử hoặc quà. Lựa chọn
              được lưu tối đa 180 ngày; thay đổi phiên bản thông báo sẽ yêu cầu chọn lại.
            </p>
            <p>
              Bạn có thể đổi ý bất cứ lúc nào. Khi từ chối, ứng dụng ngừng các sự kiện tùy chọn tiếp
              theo và xóa cookie Google Analytics do tên miền của ứng dụng tạo. Việc này không xóa
              phiên đăng nhập; dữ liệu đã gửi trước đó không thể thu hồi chỉ bằng xóa cookie.
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent(PRIVACY_PREFERENCES_EVENT, { detail: { open: true } }),
                )
              }
            >
              Mở cài đặt cookie
            </button>
            <h2>Kiểm soát dữ liệu lưu trên thiết bị</h2>
            <p>
              Bạn có thể xóa dữ liệu website trong trình duyệt. Nếu xóa cả dữ liệu đăng nhập, lần
              sau bạn cần xác thực lại bằng OTP. Xóa cookie không đồng nghĩa xóa hồ sơ trên máy chủ.
            </p>
          </>
        )}
        {kind === "data-rights" && (
          <>
            <p>
              Bạn không cần tài khoản chủ salon hoặc nhân viên để gửi yêu cầu xem, sửa, xóa dữ liệu
              hay rút lại sự đồng ý lưu ảnh.
            </p>
            <h2>Gửi yêu cầu của bạn</h2>
            {email ? (
              <>
                <ul className="data-rights-actions">
                  <li>
                    <a href={requestLink("Yêu cầu xem dữ liệu")}>Yêu cầu xem dữ liệu</a>
                  </li>
                  <li>
                    <a href={requestLink("Yêu cầu sửa dữ liệu")}>Yêu cầu sửa dữ liệu</a>
                  </li>
                  <li>
                    <a href={requestLink("Yêu cầu xóa dữ liệu")}>Yêu cầu xóa dữ liệu</a>
                  </li>
                  <li>
                    <a href={requestLink("Rút lại đồng ý lưu ảnh")}>Yêu cầu ngừng lưu ảnh</a>
                  </li>
                </ul>
                <p>
                  Các liên kết mở ứng dụng email của bạn, chưa gửi tự động. Ghi tên salon/chi nhánh
                  và phạm vi yêu cầu; chỉ gửi sau khi kiểm tra nội dung. Bộ phận hỗ trợ sẽ xác minh
                  đúng chủ thể trước khi cung cấp hoặc xóa dữ liệu.
                </p>
              </>
            ) : (
              <p>
                Vui lòng liên hệ trực tiếp salon đã phục vụ để yêu cầu xem, sửa hoặc xóa dữ liệu
                thuộc salon đó. Kênh hỗ trợ chung của CH Hair chưa được công bố; ứng dụng không tự
                tạo địa chỉ email hoặc gửi yêu cầu thay bạn.
              </p>
            )}
            <p>
              Không gửi mật khẩu, OTP, QR token, đường dẫn đăng nhập hoặc ảnh giấy tờ qua email.
            </p>
            <h2>Phạm vi và cách xử lý</h2>
            <p>
              Bạn có thể yêu cầu xử lý hồ sơ tại một salon hoặc tài khoản trên toàn hệ thống. Xóa dữ
              liệu website trên điện thoại không xóa dữ liệu trên máy chủ. Xóa hồ sơ điểm có thể làm
              mất lịch sử và quà thuộc phạm vi yêu cầu; các ngoại lệ lưu giữ theo pháp luật sẽ được
              giải thích khi xử lý.
            </p>
            <p>
              Chúng tôi tiếp nhận, xác minh và phản hồi theo thời hạn pháp luật áp dụng; không coi
              việc bấm liên kết email là đã hoàn tất xóa dữ liệu. Nếu yêu cầu chưa được giải quyết
              hoặc bạn cần hỗ trợ gửi yêu cầu, hãy liên hệ salon hoặc kênh hỗ trợ được công bố.
            </p>
            <h2>Chủ salon và nhân viên</h2>
            <p>
              <a href="/delete-account/manage">Quản lý xóa tài khoản chủ salon hoặc nhân viên</a>.
              Khu vực này có xác minh đăng nhập và không thay thế quyền dữ liệu của khách.
            </p>
          </>
        )}
        {kind === "service" && (
          <>
            <h2>Phí sử dụng hiện tại</h2>
            <p>
              CH Hair hiện chưa thu phí trong ứng dụng và chưa có chức năng nhận thanh toán. Không
              có giao dịch thanh toán ứng dụng để tự động hoàn tiền tại đây.
            </p>
            <h2>Dịch vụ tại salon</h2>
            <p>
              Tiền cắt tóc hoặc dịch vụ thanh toán trực tiếp với salon thuộc thỏa thuận giữa khách
              và salon. Salon cần thông báo rõ giá và điều kiện dịch vụ; khách có thể liên hệ salon
              hoặc kênh hỗ trợ để được hướng dẫn giải quyết phản ánh.
            </p>
            <h2>Điểm và quà</h2>
            <p>
              Điểm và mã quà không phải tiền hoặc công cụ thanh toán. Điều kiện nhận, thời hạn và
              phạm vi sử dụng được salon công bố trong ứng dụng; chúng tôi không tạo cam kết hoàn
              tiền cho điểm hoặc quà.
            </p>
            <h2>Nếu triển khai gói trả phí</h2>
            <p>
              Giá, chu kỳ, điều kiện hủy và hoàn tiền sẽ được công bố trước khi người dùng quyết
              định đăng ký. Trang này không phải lời mời thanh toán và không làm mất quyền của người
              dùng theo pháp luật áp dụng.
            </p>
          </>
        )}
        <h2>Liên hệ hỗ trợ</h2>
        <PublicContact />
        <nav aria-label="Các trang chính sách">
          <a href="/privacy">Quyền riêng tư</a>
          {" · "}
          <a href="/terms">Điều khoản</a>
          {" · "}
          <a href="/cookies">Cookie</a>
          {" · "}
          <a href="/data-rights">Quyền dữ liệu</a>
          {" · "}
          <a href="/service-policy">Dịch vụ</a>
        </nav>
      </div>
    </section>
  );
}
