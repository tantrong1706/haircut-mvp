import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import {
  runAppCheckDiagnostic,
  type AppCheckDiagnosticResult,
} from "../services/appCheckDiagnostic";

export function AppCheckDiagnosticPage() {
  const [result, setResult] = useState<AppCheckDiagnosticResult | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function check() {
    if (started.current) return;
    started.current = true;
    setBusy(true);
    try {
      const next = await runAppCheckDiagnostic();
      if (active.current) setResult(next);
    } catch {
      if (active.current) setResult({ status: "failed", code: "CHECK_FAILED" });
    } finally {
      if (active.current) setBusy(false);
    }
  }

  return (
    <section className="page">
      <header className="customer-hero">
        <BrandLogo />
        <p className="eyebrow">Kiểm tra hỗ trợ</p>
        <h1>Kiểm tra bảo vệ</h1>
        <p className="muted">
          Mở trang này trên điện thoại và trình duyệt bạn dùng cho trang khách.
        </p>
      </header>
      <div className="panel">
        <ShieldCheck size={28} aria-hidden="true" />
        <p>Bấm một lần để kiểm tra. Sau đó gửi trạng thái hiển thị cho người hỗ trợ.</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => void check()}
          disabled={busy || result !== null}
        >
          {busy ? "Đang kiểm tra..." : "Kiểm tra ngay"}
        </button>
        {busy ? <p role="status">Quá trình kiểm tra có thể mất khoảng 25 giây.</p> : null}
        {result?.status === "passed" ? (
          <div role="status" className="alert success">
            <CheckCircle2 size={20} aria-hidden="true" />
            <strong>Kiểm tra thành công</strong>
            <p>Trình duyệt đã được App Check xác minh.</p>
          </div>
        ) : result ? (
          <div role="status" className="alert error">
            <strong>Chưa xác minh được trình duyệt</strong>
            <p>
              Mã kết quả: {result.code}
              {result.httpStatus ? ` · HTTP ${result.httpStatus}` : ""}
            </p>
          </div>
        ) : null}
        <small>
          Trang kiểm tra dùng reCAPTCHA Enterprise của Google. Token không được hiển thị.{" "}
          <a href="https://policies.google.com/privacy" className="privacy-link">
            Quyền riêng tư
          </a>
          {" · "}
          <a href="https://policies.google.com/terms" className="privacy-link">
            Điều khoản Google
          </a>
        </small>
      </div>
      <a className="secondary-button" href="/">
        Trở về trang khách
      </a>
    </section>
  );
}
