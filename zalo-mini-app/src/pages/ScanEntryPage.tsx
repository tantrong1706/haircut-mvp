import { useEffect, useRef, useState } from "react";
import {
  Camera,
  MessageCircle,
  Phone,
  RefreshCcw,
  Scissors,
  UserRound,
} from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { buildRegisterInput, parseQrContext, registerCustomer } from "../services/api";
import { AppSession } from "../services/types";
import { ZaloIdentity, getZaloIdentity } from "../services/zalo";

type Props = {
  onReady: (session: AppSession) => void;
};

export function ScanEntryPage({ onReady }: Props) {
  const [allowPhoto, setAllowPhoto] = useState(false);
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [identity, setIdentity] = useState<ZaloIdentity | null>(null);
  const [loadingIdentity, setLoadingIdentity] = useState(true);
  const [zaloRequired, setZaloRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameTouchedRef = useRef(false);
  const mountedRef = useRef(false);
  const qr = parseQrContext();

  useEffect(() => {
    mountedRef.current = true;

    loadZaloIdentity();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  function loadZaloIdentity() {
    setLoadingIdentity(true);
    setZaloRequired(false);
    setError(null);

    getZaloIdentity()
      .then((nextIdentity) => {
        if (!mountedRef.current) {
          return;
        }

        setIdentity(nextIdentity);
        if (!nameTouchedRef.current) {
          setDisplayName(normalizeDisplayName(nextIdentity.name));
        }
      })
      .catch((err) => {
        if (mountedRef.current) {
          setZaloRequired(true);
          setError(err instanceof Error ? err.message : "Vui lòng mở HAIRCUT trong Zalo để xác nhận danh tính.");
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
    try {
      const confirmedIdentity = identity ?? (await getZaloIdentity());
      const session = await registerCustomer(
        buildRegisterInput(
          qr,
          { ...confirmedIdentity, name: confirmedName },
          allowPhoto,
          phone || undefined,
        ),
      );
      onReady(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo hồ sơ khách");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="entry-page">
      <header className="entry-hero premium-hero">
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
              HAIRCUT cần xác nhận danh tính Zalo trước khi tạo lượt cắt. Vui lòng mở link này trong Zalo hoặc quét lại QR tại salon.
            </p>
          </div>
          <div className="button-row wrap-row">
            {zaloOpenUrl(qr) ? (
              <button className="primary-button" onClick={() => window.location.assign(zaloOpenUrl(qr))}>
                <MessageCircle size={20} aria-hidden="true" />
                Mở trong Zalo
              </button>
            ) : null}
            <button className="secondary-button" onClick={() => loadZaloIdentity()}>
              <RefreshCcw size={18} aria-hidden="true" />
              Thử lại
            </button>
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
          />
          <small>Không bắt buộc. Salon chỉ hiển thị 4 số cuối cho nhân viên.</small>
        </label>

        <label className="toggle-row photo-consent">
          <input
            type="checkbox"
            checked={allowPhoto}
            onChange={(event) => setAllowPhoto(event.target.checked)}
          />
          <Camera size={18} aria-hidden="true" />
          <span>Đồng ý lưu ảnh kiểu tóc cho lần sau</span>
        </label>
        <p className="field-note">Dữ liệu chỉ dùng cho chăm sóc khách hàng tại salon này.</p>
      </div>

      {error ? <p className="alert error">{error}</p> : null}

      <button
        className="primary-button"
        disabled={loading || displayName.trim().length === 0}
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
  if (mirrorId.includes("mirror-1")) {
    return "Gương 1";
  }

  return mirrorId || "Gương";
}

function zaloOpenUrl(qr: ReturnType<typeof parseQrContext>) {
  const miniAppId = String(import.meta.env.VITE_ZALO_MINI_APP_ID || "").trim();

  if (!miniAppId) {
    return "";
  }

  const params = new URLSearchParams(qr);
  return `https://zalo.me/s/${miniAppId}?${params.toString()}`;
}
