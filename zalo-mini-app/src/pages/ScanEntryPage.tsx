import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  MessageCircle,
  Phone,
  Scissors,
  ShieldCheck,
  Sparkles,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameTouchedRef = useRef(false);
  const qr = parseQrContext();

  useEffect(() => {
    let mounted = true;

    getZaloIdentity()
      .then((nextIdentity) => {
        if (!mounted) {
          return;
        }

        setIdentity(nextIdentity);
        if (!nameTouchedRef.current) {
          setDisplayName(normalizeDisplayName(nextIdentity.name));
        }
      })
      .catch(() => {
        if (mounted) {
          setError("Không lấy được tên Zalo. Bạn có thể nhập tên hiển thị thủ công.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingIdentity(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

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
        <p className="eyebrow">Check-in tại salon</p>
        <h1>Xác nhận lượt cắt của bạn</h1>
        <p className="muted">
          Quét QR một lần để salon nhận khách, lưu ghi chú kiểu tóc và cộng điểm sau khi chủ salon duyệt.
        </p>
      </header>

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

      <div className="flow-steps">
        <Step number="1" title="Khách xác nhận" text="Salon nhận đúng khách tại gương." />
        <Step number="2" title="Nhân viên ghi chú" text="Kiểu tóc và yêu cầu cộng điểm được gửi sau khi cắt." />
        <Step number="3" title="Chủ salon duyệt" text="Điểm, lịch sử và quà được cập nhật cho khách." />
      </div>

      <div className="trust-row">
        <span>
          <CheckCircle2 size={18} aria-hidden="true" />
          Cộng điểm sau khi cắt
        </span>
        <span>
          <ShieldCheck size={18} aria-hidden="true" />
          Khách chủ động đồng ý
        </span>
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
      </div>

      {error ? <p className="alert error">{error}</p> : null}

      <button className="primary-button" disabled={loading || displayName.trim().length === 0} onClick={continueWithZalo}>
        {loading ? (
          "Đang xử lý..."
        ) : (
          <>
            <MessageCircle size={20} aria-hidden="true" />
            Xác nhận và tạo lượt cắt
          </>
        )}
      </button>

      <p className="fine-print">
        Bạn không cần tạo tài khoản. Salon chỉ dùng thông tin này để cộng điểm và lưu lịch sử cắt tóc.
      </p>

      <p className="fine-print">
        <Sparkles size={16} aria-hidden="true" />
        Mỗi lượt quét tạo một phiên phục vụ riêng cho đúng gương/ghế.
      </p>
    </section>
  );
}

function normalizeDisplayName(name: string) {
  return name.replace(/\s+/g, " ").trim();
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="flow-step">
      <strong>{number}</strong>
      <span>{title}</span>
      <small>{text}</small>
    </div>
  );
}

function mirrorLabel(mirrorId: string) {
  if (mirrorId.includes("mirror-1")) {
    return "Gương 1";
  }

  return mirrorId || "Gương";
}
