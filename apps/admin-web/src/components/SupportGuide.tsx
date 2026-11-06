import { ArrowRight, CircleHelp, ExternalLink } from "lucide-react";
import { supportLinks } from "../services/adminSupport";

const guides = [
  {
    title: "Điểm chưa cập nhật",
    steps: [
      "Chọn đúng salon, đối chiếu yêu cầu điểm và chi nhánh.",
      "Kiểm tra nhân viên đã xác nhận và thời gian chống cộng lặp.",
      "Không cộng bù điểm trực tiếp; lỗi ngoài phạm vi cần đối chiếu nhật ký.",
    ],
  },
  {
    title: "Ảnh hoặc ghi chú không lưu",
    steps: [
      "Kiểm tra đồng ý lưu ảnh, quyền của thợ và đúng chi nhánh.",
      "Đối chiếu lượt đang chờ hoặc lượt vừa hoàn tất được phép bổ sung.",
      "Xem nhật ký tải ảnh; không mở ảnh công khai hoặc sửa Rules để chữa tạm.",
    ],
  },
  {
    title: "Đăng nhập hoặc quyền truy cập",
    steps: [
      "Xác minh đúng tài khoản và phiên đăng nhập quản trị.",
      "Nếu phiên xác nhận đã cũ, đăng xuất và đăng nhập lại.",
      "Không tự cấp quyền, đổi mật khẩu hoặc giả danh tài khoản từ trang này.",
    ],
  },
  {
    title: "Nhiều salon cùng gặp lỗi",
    steps: [
      "Kiểm tra thời điểm lỗi, trạng thái dịch vụ và lần phát hành gần nhất.",
      "Mở nhật ký backend, Billing hoặc chỉ mục bằng các công cụ bên dưới.",
      "Không tắt App Check, nới quyền hoặc xóa dữ liệu để thử cho hết lỗi.",
    ],
  },
];

export function SupportGuide({
  projectId,
  onOpenSalons,
}: {
  projectId: string;
  onOpenSalons: () => void;
}) {
  return (
    <section className="content-section incident-guide">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Hướng dẫn xử lý</p>
          <h2>Bạn đang gặp vấn đề gì?</h2>
          <p className="muted">
            Bắt đầu từ đúng salon. Chỉ sửa dữ liệu khi đã đối chiếu được nguyên nhân.
          </p>
        </div>
        <button className="primary" onClick={onOpenSalons}>
          Chọn salon để kiểm tra <ArrowRight aria-hidden="true" />
        </button>
      </div>
      <div className="incident-grid">
        {guides.map((guide) => (
          <article className="surface" key={guide.title}>
            <CircleHelp aria-hidden="true" />
            <h3>{guide.title}</h3>
            <ol>
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>
        ))}
      </div>
      <div className="section-heading tools-heading">
        <div>
          <p className="eyebrow">Công cụ hạ tầng</p>
          <h2>Mở đúng nơi kiểm tra</h2>
          <p className="muted">
            Chỉ mở công cụ của project hiện tại. Không tự thanh toán, tạo chỉ mục hoặc thay cấu
            hình.
          </p>
        </div>
      </div>
      <div className="support-links">
        {supportLinks(projectId).map((link) => (
          <article key={link.href}>
            <h3>{link.label}</h3>
            <p>{link.description}</p>
            <a className="text-button" href={link.href} target="_blank" rel="noopener noreferrer">
              Mở công cụ Google <ExternalLink aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
