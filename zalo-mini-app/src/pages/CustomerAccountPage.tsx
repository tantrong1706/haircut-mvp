import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { signOutCustomerWeb } from "../services/customerWebAuth";
import { captureError, trackEvent } from "../services/monitoring";
import type { AppSession } from "../services/types";

type Props = {
  session: AppSession;
  onLoggedOut: () => void;
};

export function CustomerAccountPage({ session, onLoggedOut }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signOutCustomerWeb();
      trackEvent("web_customer_logged_out", { salon_id: session.qr.salonId });
      onLoggedOut();
    } catch (logoutError) {
      setError("Chưa đăng xuất được. Vui lòng kiểm tra mạng và thử lại.");
      captureError(logoutError, { flow: "web_customer_logout" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page customer-account-page">
      <header className="customer-hero compact-hero">
        <BrandLogo />
        <p className="eyebrow">Tài khoản</p>
        <h1>{session.customer.name || "Khách hàng"}</h1>
        <p className="muted">
          Số điện thoại đã xác thực •••• {session.customer.phoneLast4 || "----"}
        </p>
      </header>
      <div className="account-balance">
        <span>Điểm hiện có</span>
        <strong>
          {session.customer.points} <small>điểm</small>
        </strong>
      </div>
      <div className="panel account-device">
        <ShieldCheck size={26} aria-hidden="true" />
        <div>
          <h2>Thiết bị của bạn</h2>
          <p>Phiên đăng nhập được ghi nhớ an toàn trên thiết bị và trình duyệt này.</p>
        </div>
      </div>
      <div className="account-session-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => void logOut()}
          disabled={busy}
        >
          {busy ? "Đang đăng xuất..." : "Đăng xuất khỏi thiết bị này"}
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </section>
  );
}
