import { useState } from "react";
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
      <div className="brand-mark">HAIRCUT</div>
      <h1>Chào mừng bạn</h1>
      <p className="muted">
        Bạn đang quét QR tại gương. Tiếp tục với Zalo để salon nhận đúng hồ sơ
        và cộng điểm sau khi cắt.
      </p>

      <div className="panel">
        <label className="field">
          <span>Số điện thoại</span>
          <input
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Không bắt buộc"
          />
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

      {error ? <p className="error">{error}</p> : null}

      <button className="primary-button" disabled={loading} onClick={continueWithZalo}>
        {loading ? "Đang xử lý..." : "Tiếp tục với Zalo"}
      </button>
    </section>
  );
}

