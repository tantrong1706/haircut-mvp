import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  MessageCircle,
  Phone,
  QrCode,
  RefreshCcw,
  Scissors,
  UserRound,
} from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { buildRegisterInput, registerCustomer } from "../services/api";
import { captureError, trackEvent, withMonitoringTrace } from "../services/monitoring";
import { hasQrContext, parseQrContext } from "../services/qr";
import { isZaloMiniAppRuntime } from "../services/runtime";
import type { AppSession } from "../services/types";
import { getZaloIdentity } from "../services/zalo";

type Props = {
  onReady: (session: AppSession) => void;
};

export function ScanEntryPage({ onReady }: Props) {
  const [allowPhoto, setAllowPhoto] = useState(false);
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loadingIdentity, setLoadingIdentity] = useState(true);
  const [zaloRequired, setZaloRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameTouchedRef = useRef(false);
  const mountedRef = useRef(false);

  const qr = useMemo(() => parseQrContext(), []);
  const hasQr = useMemo(() => hasQrContext(), []);
  const isZaloRuntime = useMemo(() => isZaloMiniAppRuntime(), []);

  useEffect(() => {
    mountedRef.current = true;

    if (!hasQr) {
      setLoadingIdentity(false);

      return () => {
        mountedRef.current = false;
      };
    }

    if (!isZaloRuntime) {
      setLoadingIdentity(false);
      setZaloRequired(true);

      return () => {
        mountedRef.current = false;
      };
    }

    loadZaloIdentity();

    return () => {
      mountedRef.current = false;
    };
  }, [hasQr, isZaloRuntime]);

  function loadZaloIdentity() {
    if (!isZaloRuntime) {
      setLoadingIdentity(false);
      setZaloRequired(true);
      setError(null);
      return;
    }

    setLoadingIdentity(true);
    setZaloRequired(false);
    setError(null);

    getZaloIdentity()
      .then((nextIdentity) => {
        if (!mountedRef.current) {
          return;
        }

        if (!nameTouchedRef.current) {
          setDisplayName(normalizeDisplayName(nextIdentity.name));
        }
      })
      .catch((err) => {
        captureError(err, {
          area: "zalo_identity",
          salon_id: qr.salonId,
          mirror_id: qr.mirrorId,
        });

        if (mountedRef.current) {
          setZaloRequired(true);
          setError(
            err instanceof Error
              ? err.message
              : "Vui lòng mở HAIRCUT trong Zalo để xác nhận danh tính.",
          );
        }
      })
      .finally(() => {
        if (mountedRef.current) {
          setLoadingIdentity(false);
        }
      });
  }

  async function continueWithZalo() {
    const confirmedName = normalizeDisplayName(displayName);

    if (!confirmedName) {
      setError("Vui lòng nhập tên hiển thị tại salon để nhân viên dễ nhận khách.");
      return;
    }

    setLoading(true);
    setError(null);

    trackEvent("customer_checkin_started", {
      salon_id: qr.salonId,
      mirror_id: qr.mirrorId,
      has_phone: Boolean(phone.trim()),
      allow_photo: allowPhoto,
    });

    try {
      /*
       * Luôn lấy access token mới ngay khi khách
       * bấm tạo lượt cắt, không dùng token cũ.
       */
      const confirmedIdentity = await getZaloIdentity();

      const session = await withMonitoringTrace(
        "customer_checkin",
        () =>
          registerCustomer(
            buildRegisterInput(
              qr,
              {
                ...confirmedIdentity,
                name: confirmedName,
              },
              allowPhoto,
              phone || undefined,
            ),
          ),
        {
          salon_id: qr.salonId,
          mirror_id: qr.mirrorId,
        },
      );

      trackEvent("customer_checkin_created", {
        salon_id: qr.salonId,
        mirror_id: qr.mirrorId,
        session_status: session.sessionStatus,
      });

      onReady(session);
    } catch (err) {
      captureError(err, {
        area: "customer_checkin",
        salon_id: qr.salonId,
        mirror_id: qr.mirrorId,
      });

      setError(err instanceof Error ? err.message : "Không thể tạo hồ sơ khách");
    } finally {
      setLoading(false);
    }
  }

  if (!hasQr) {
    return (
      <section className="entry-page">
        <header className="entry-hero premium-hero visual-hero">
          <div className="hero-topline">
            <BrandLogo />
            <span className="soft-chip">HAIRCUT</span>
          </div>

          <p className="eyebrow">Check-in</p>
          <h1>Quét QR tại salon</h1>

          <p className="muted">Khách cần quét đúng QR ở gương/ghế để tạo lượt cắt.</p>
        </header>

        <div className="panel missing-qr-panel">
          <QrCode size={38} aria-hidden="true" />

          <div>
            <h2>Chưa có QR gương</h2>

            <p className="muted">
              Nếu bạn là chủ salon, vào trang quản lý để tạo QR cho từng gương rồi đưa link đó cho
              khách.
            </p>
          </div>
        </div>

        <div className="quick-actions">
          <button type="button" onClick={() => window.location.assign("/owner")}>
            <span>
              <ArrowRight size={20} aria-hidden="true" />
            </span>

            <div>
              <strong>Trang chủ salon</strong>
              <small>Tạo QR, nhân viên, vòng quay</small>
            </div>
          </button>

          <button type="button" onClick={() => window.location.assign("/staff")}>
            <span>
              <Scissors size={20} aria-hidden="true" />
            </span>

            <div>
              <strong>Trang nhân viên</strong>
              <small>Xem khách đang chờ và đổi mã quà</small>
            </div>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="entry-page">
      <header className="entry-hero premium-hero visual-hero">
        <div className="hero-topline">
          <BrandLogo />

          <span className="soft-chip">{mirrorLabel(qr.mirrorId)}</span>
        </div>

        <p className="eyebrow">Check-in</p>
        <h1>{mirrorLabel(qr.mirrorId)}</h1>

        <p className="muted">Xác nhận để salon nhận đúng khách và cộng điểm sau khi cắt.</p>
      </header>

      {zaloRequired ? (
        <div className="panel zalo-required-card">
          <MessageCircle size={34} aria-hidden="true" />

          <div>
            <h2>Cần mở trong Zalo</h2>

            <p className="muted">
              HAIRCUT cần xác nhận danh tính Zalo trước khi tạo lượt cắt. Vui lòng quét lại QR tại
              salon.
            </p>
          </div>

          <div className="button-row wrap-row">
            {zaloOpenUrl(qr) ? (
              <button
                className="primary-button"
                onClick={() => window.location.assign(zaloOpenUrl(qr))}
              >
                <MessageCircle size={20} aria-hidden="true" />
                Mở trong Zalo
              </button>
            ) : null}

            {isZaloRuntime ? (
              <button className="secondary-button" onClick={loadZaloIdentity}>
                <RefreshCcw size={18} aria-hidden="true" />
                Thử lại
              </button>
            ) : null}
          </div>

          {error ? <p className="alert error">{error}</p> : null}
        </div>
      ) : null}

      {!zaloRequired ? (
        <>
          <div className="mirror-card">
            <div className="mirror-visual">
              <Scissors size={34} aria-hidden="true" />
            </div>

            <div>
              <span>Vị trí hiện tại</span>

              <strong>{mirrorLabel(qr.mirrorId)}</strong>

              <small>Phiên phục vụ sẽ gắn với đúng gương/ghế này.</small>
            </div>
          </div>

          <div className="panel form-panel">
            <label className="field">
              <span>
                <UserRound size={18} aria-hidden="true" />
                Tên hiển thị tại salon
              </span>

              <input
                value={displayName}
                onChange={(event) => {
                  nameTouchedRef.current = true;
                  setDisplayName(event.target.value);
                }}
                placeholder={loadingIdentity ? "Đang lấy tên Zalo..." : "Ví dụ: Anh Tân"}
                disabled={loading}
              />

              <small>Mặc định lấy từ Zalo, bạn có thể sửa để nhân viên dễ gọi đúng tên.</small>
            </label>

            <label className="field">
              <span>
                <Phone size={18} aria-hidden="true" />
                Số điện thoại
              </span>

              <input
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Nhập nếu muốn salon dễ nhận ra bạn"
                disabled={loading}
              />

              <small>Không bắt buộc. Salon chỉ hiển thị 4 số cuối cho nhân viên.</small>
            </label>

            <label className="toggle-row photo-consent">
              <input
                type="checkbox"
                checked={allowPhoto}
                onChange={(event) => setAllowPhoto(event.target.checked)}
                disabled={loading}
              />

              <Camera size={18} aria-hidden="true" />

              <span>Đồng ý lưu ảnh kiểu tóc cho lần sau</span>
            </label>

            <p className="field-note">Dữ liệu chỉ dùng cho chăm sóc khách hàng tại salon này.</p>
          </div>

          {error ? <p className="alert error">{error}</p> : null}

          <button
            className="primary-button"
            disabled={loading || loadingIdentity || displayName.trim().length === 0}
            onClick={continueWithZalo}
          >
            {loading ? (
              "Đang xử lý..."
            ) : (
              <>
                <MessageCircle size={20} aria-hidden="true" />
                Xác nhận và tạo lượt cắt
              </>
            )}
          </button>
        </>
      ) : null}
    </section>
  );
}

function normalizeDisplayName(name: string) {
  return name.replace(/\s+/g, " ").trim();
}

function mirrorLabel(mirrorId: string) {
  const previewMirrorId = String(import.meta.env.VITE_PREVIEW_MIRROR_ID || "").trim();

  if (mirrorId.includes("mirror-1") || (previewMirrorId && mirrorId === previewMirrorId)) {
    return "Gương 1";
  }

  return mirrorId || "Gương";
}

function zaloOpenUrl(qr: ReturnType<typeof parseQrContext>) {
  /*
   * Trong bản Development không tự chuyển về
   * link production vì Zalo sẽ báo ứng dụng
   * đang trong giai đoạn phát triển.
   */
  if (import.meta.env.VITE_ZALO_PREVIEW === "true") {
    return "";
  }

  const miniAppId = String(import.meta.env.VITE_ZALO_MINI_APP_ID || "").trim();

  if (!miniAppId) {
    return "";
  }

  const params = new URLSearchParams({
    salonId: qr.salonId,
    mirrorId: qr.mirrorId,
    qrToken: qr.qrToken,
  });

  return `https://zalo.me/s/${miniAppId}?${params.toString()}`;
}
