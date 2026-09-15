import { useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "../components/BrandLogo";
import {
  beginCustomerPhoneSignIn,
  clearPendingWebQr,
  confirmCustomerPhoneSignIn,
  customerPhoneAuthErrorMessage,
  loadPendingWebQr,
  savePendingWebQr,
  subscribeCustomerWebAuth,
  type CustomerPhoneConfirmation,
} from "../services/customerWebAuth";
import { captureError, trackEvent } from "../services/monitoring";
import { hasQrContext, parseQrContext } from "../services/qr";
import {
  checkInWebCustomer,
  resolveWebCustomerContext,
  type WebCustomerContext,
} from "../services/webCustomerApi";
import type { AppSession, QrContext } from "../services/types";

type Props = {
  onReady: (session: AppSession) => void;
};

type AuthStatus = "initializing" | "signed_out" | "authenticated" | "error";

export function WebCustomerEntryPage({ onReady }: Props) {
  const qr = useMemo(resolveInitialQr, []);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("initializing");
  const [context, setContext] = useState<WebCustomerContext | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<CustomerPhoneConfirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const checkinStarted = useRef(false);

  useEffect(() => {
    if (hasQrContext(qr)) {
      savePendingWebQr(qr);
      trackEvent("web_qr_opened", { salon_id: qr.salonId, qr_type: qr.qrType });
    }
  }, [qr]);

  useEffect(
    () =>
      subscribeCustomerWebAuth(
        (user) => {
          if (user) {
            setAuthStatus("authenticated");
            trackEvent("web_auth_restored", { salon_id: qr.salonId });
          } else {
            setAuthStatus("signed_out");
            setContext(null);
            trackEvent("web_auth_required", { salon_id: qr.salonId });
          }
        },
        (authError) => {
          setAuthStatus("error");
          setError(customerPhoneAuthErrorMessage(authError));
          captureError(authError, { flow: "web_customer_auth_restore" });
        },
      ),
    [qr.salonId],
  );

  useEffect(() => {
    if (authStatus !== "authenticated" || !hasQrContext(qr)) return undefined;
    let active = true;
    setBusy(true);
    setError("");
    void resolveWebCustomerContext(qr)
      .then((result) => {
        if (!active) return;
        clearPendingWebQr();
        if (result.activeSession) {
          onReady(result.activeSession);
          return;
        }
        setContext(result);
      })
      .catch((resolveError) => {
        if (!active) return;
        setError(resolveError instanceof Error ? resolveError.message : "Không tải được salon.");
        captureError(resolveError, { flow: "web_customer_context" });
      })
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [authStatus, onReady, qr]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setInterval(
      () => setResendSeconds((seconds) => Math.max(0, seconds - 1)),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  async function sendOtp() {
    if (busy || resendSeconds > 0) return;
    setBusy(true);
    setError("");
    try {
      const nextConfirmation = await beginCustomerPhoneSignIn(phone, "customer-phone-recaptcha");
      setConfirmation(nextConfirmation);
      setResendSeconds(60);
    } catch (sendError) {
      setError(customerPhoneAuthErrorMessage(sendError));
      captureError(sendError, { flow: "web_customer_send_otp" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmOtp() {
    if (!confirmation || busy) return;
    setBusy(true);
    setError("");
    try {
      await confirmCustomerPhoneSignIn(confirmation, otp);
      trackEvent("web_auth_success", { salon_id: qr.salonId, provider: "phone" });
    } catch (confirmError) {
      setError(customerPhoneAuthErrorMessage(confirmError));
      captureError(confirmError, { flow: "web_customer_confirm_otp" });
    } finally {
      setBusy(false);
    }
  }

  async function checkIn() {
    if (busy || checkinStarted.current) return;
    checkinStarted.current = true;
    setBusy(true);
    setError("");
    trackEvent("web_checkin_started", { salon_id: qr.salonId, branch_id: qr.branchId });
    try {
      const session = await checkInWebCustomer(qr);
      trackEvent("web_checkin_success", { salon_id: qr.salonId, branch_id: qr.branchId });
      onReady(session);
    } catch (checkinError) {
      checkinStarted.current = false;
      setError(checkinError instanceof Error ? checkinError.message : "Không thể check-in.");
      trackEvent("web_checkin_failed", { salon_id: qr.salonId, branch_id: qr.branchId });
      captureError(checkinError, { flow: "web_customer_checkin" });
    } finally {
      setBusy(false);
    }
  }

  if (!hasQrContext(qr)) {
    return (
      <section className="panel empty-state" role="alert">
        <BrandLogo />
        <h1>Cần QR của salon</h1>
        <p>Vui lòng quét QR do salon cung cấp để mở đúng chi nhánh.</p>
      </section>
    );
  }

  if (authStatus === "initializing") {
    return (
      <section className="panel loading-panel" aria-live="polite">
        <BrandLogo />
        <strong>Đang kiểm tra đăng nhập...</strong>
        <p>Thiết bị đang khôi phục phiên khách đã lưu.</p>
      </section>
    );
  }

  if (authStatus === "signed_out") {
    return (
      <section className="page web-customer-auth">
        <header className="customer-hero compact-hero">
          <BrandLogo />
          <p className="eyebrow">Khách hàng</p>
          <h1>Đăng nhập bằng số điện thoại</h1>
          <p className="muted">Chỉ cần xác thực lần đầu trên thiết bị này.</p>
        </header>
        <div className="panel auth-card">
          <label htmlFor="customer-phone">Số điện thoại</label>
          <input
            id="customer-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="090 123 4567"
            disabled={busy || Boolean(confirmation)}
          />
          {!confirmation ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => void sendOtp()}
              disabled={busy || resendSeconds > 0}
            >
              {busy
                ? "Đang gửi..."
                : resendSeconds > 0
                  ? `Gửi lại sau ${resendSeconds}s`
                  : "Gửi mã OTP"}
            </button>
          ) : (
            <>
              <label htmlFor="customer-otp">Mã OTP</label>
              <input
                id="customer-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6 chữ số"
              />
              <button
                type="button"
                className="primary-button"
                onClick={() => void confirmOtp()}
                disabled={busy || otp.length !== 6}
              >
                {busy ? "Đang xác thực..." : "Xác nhận OTP"}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy || resendSeconds > 0}
                onClick={() => {
                  setConfirmation(null);
                  setOtp("");
                }}
              >
                {resendSeconds > 0 ? `Gửi lại sau ${resendSeconds}s` : "Gửi mã mới"}
              </button>
            </>
          )}
          <div id="customer-phone-recaptcha" />
          {error ? <p role="alert">{error}</p> : null}
        </div>
      </section>
    );
  }

  if (authStatus === "error") {
    return (
      <section className="panel empty-state" role="alert">
        <h1>Chưa khôi phục được đăng nhập</h1>
        <p>{error}</p>
      </section>
    );
  }

  if (!context) {
    return (
      <section className="panel loading-panel" aria-live="polite">
        <strong>Đang tải thông tin salon...</strong>
        {error ? <p role="alert">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="page web-checkin-page">
      <header className="customer-hero compact-hero">
        <BrandLogo />
        <p className="eyebrow">Check-in</p>
        <h1>{context.qr.salonName}</h1>
        <p className="muted">{context.qr.branchName}</p>
        {context.qr.branchAddress ? <p>{context.qr.branchAddress}</p> : null}
      </header>
      <div className="panel web-customer-summary">
        <span>{context.customer.name}</span>
        <strong>{context.customer.points} điểm</strong>
        <p>Khi check-in, nhân viên có thể lưu tối đa 3 ảnh của lần cắt vào lịch sử phục vụ.</p>
        <button
          type="button"
          className="primary-button"
          onClick={() => void checkIn()}
          disabled={busy}
        >
          {busy ? "Đang check-in..." : "Check-in"}
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </section>
  );
}

function resolveInitialQr(): QrContext {
  const parsed = parseQrContext();
  if (hasQrContext(parsed)) return parsed;
  return loadPendingWebQr() ?? parsed;
}
