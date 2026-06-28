import { useState } from "react";
import { CheckCircle2, MessageCircle, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { buildRegisterInput, parseQrContext, registerCustomer } from "../services/api";
import { AppSession } from "../services/types";
import { getZaloIdentity } from "../services/zalo";

type Props = {
  onReady: (session: AppSession) => void;
};

export function ScanEntryPage({ onReady }: Props) {
  const [allowPhoto, setAllowPhoto] = useState(true);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qr = parseQrContext();

  async function continueWithZalo() {
    setLoading(true);
    setError(null);
    try {
      const identity = await getZaloIdentity();
      const session = await registerCustomer(
        buildRegisterInput(qr, identity, allowPhoto, phone || undefined),
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
      <header className="entry-hero">
        <div className="hero-topline">
          <div className="brand-mark">HAIRCUT</div>
          <span className="soft-chip">{mirrorLabel(qr.mirrorId)}</span>
        </div>
        <p className="eyebrow">Chăm sóc khách quen</p>
        <h1>Nhận diện khách tại gương</h1>
        <p className="muted">
          Salon sẽ dùng hồ sơ này để lưu kiểu tóc, cộng điểm và gửi ưu đãi sau mỗi lần cắt.
        </p>
      </header>

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

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={allowPhoto}
            onChange={(event) => setAllowPhoto(event.target.checked)}
          />
          <span>Đồng ý lưu ảnh kiểu tóc cho lần sau</span>
        </label>
      </div>

      {error ? <p className="alert error">{error}</p> : null}

      <button className="primary-button" disabled={loading} onClick={continueWithZalo}>
        {loading ? (
          "Đang xử lý..."
        ) : (
          <>
            <MessageCircle size={20} aria-hidden="true" />
            Tiếp tục với Zalo
          </>
        )}
      </button>

      <p className="fine-print">
        <Sparkles size={16} aria-hidden="true" />
        Mỗi lượt quét tạo một phiên phục vụ riêng cho đúng gương/ghế.
      </p>
    </section>
  );
}

function mirrorLabel(mirrorId: string) {
  if (mirrorId.includes("mirror-1")) {
    return "Gương 1";
  }

  return mirrorId || "Gương";
}
