import { useEffect, useMemo, useState } from "react";
import { Gift, LockKeyhole, Sparkles, Ticket } from "lucide-react";
import { getCustomerWheelConfig, spinWheel } from "../services/api";
import {
  AppSession,
  LuckyWheelConfig,
  SpinResult,
  defaultLuckyWheelConfig,
} from "../services/types";
import { activeWheelSlots } from "../services/wheel";

type Props = {
  session: AppSession;
  onSessionChange: (session: AppSession) => void;
};

export function WheelPage({ session, onSessionChange }: Props) {
  const [wheelConfig, setWheelConfig] = useState<LuckyWheelConfig>(defaultLuckyWheelConfig);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const slots = useMemo(() => activeWheelSlots(wheelConfig), [wheelConfig]);
  const missingPoints = Math.max(0, wheelConfig.requiredPoints - session.customer.points);
  const canSpin = !loadingConfig && !spinning && missingPoints === 0 && slots.length > 0;
  const wheelStyle = useMemo(() => ({ background: wheelBackground(slots.length) }), [slots.length]);

  useEffect(() => {
    setLoadingConfig(true);
    getCustomerWheelConfig(session.qr.salonId)
      .then((config) => {
        setWheelConfig(config);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Không tải được cấu hình vòng quay"),
      )
      .finally(() => setLoadingConfig(false));
  }, [session.qr.salonId]);

  async function handleSpin() {
    setSpinning(true);
    setError(null);
    try {
      const spinResult = await spinWheel(session);
      setResult(spinResult);
      onSessionChange({
        ...session,
        customer: {
          ...session.customer,
          points: spinResult.pointsAfter,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bạn chưa đủ điểm để quay");
    } finally {
      setSpinning(false);
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">Cần {wheelConfig.requiredPoints} điểm để quay</p>
        <h1>Vòng quay may mắn</h1>
        <p className="muted">
          Bạn đang có {session.customer.points} điểm.{" "}
          {missingPoints > 0 ? `Cần thêm ${missingPoints} điểm.` : "Bạn đã đủ điểm để quay."}
        </p>
      </header>

      <div className="wheel-stage">
        <div className="wheel-pointer" aria-hidden="true" />
        <div className={spinning ? "wheel spinning" : "wheel"} style={wheelStyle}>
          <div className="wheel-center">
            <Sparkles size={26} aria-hidden="true" />
            <span>HAIRCUT</span>
          </div>
        </div>
      </div>

      <div className="prize-strip" aria-label="Các ô phần thưởng">
        {slots.map((slot, index) => (
          <span key={`${slot.label}-${index}`}>
            <Ticket size={15} aria-hidden="true" />
            {slot.label}
          </span>
        ))}
      </div>

      <button
        className="primary-button"
        disabled={!canSpin}
        onClick={handleSpin}
      >
        {loadingConfig ? (
          "Đang tải vòng quay..."
        ) : spinning ? (
          "Đang quay..."
        ) : missingPoints > 0 ? (
          <>
            <LockKeyhole size={20} aria-hidden="true" />
            Cần thêm {missingPoints} điểm
          </>
        ) : (
          <>
            <Sparkles size={20} aria-hidden="true" />
            Quay ngay
          </>
        )}
      </button>

      {slots.length === 0 ? (
        <div className="empty-state">
          <Gift size={30} aria-hidden="true" />
          <strong>Salon chưa bật phần thưởng</strong>
          <p>Chủ salon có thể cấu hình các ô trong trang quản lý.</p>
        </div>
      ) : null}

      {error ? <p className="alert error">{error}</p> : null}

      {result ? (
        <div className="reward-result">
          <Gift size={32} aria-hidden="true" />
          <p>Chúc mừng, bạn nhận được</p>
          <strong>{result.rewardName}</strong>
          <span>Mã quà: {result.rewardCode}</span>
          <small>Hãy đưa mã này cho nhân viên khi sử dụng.</small>
        </div>
      ) : null}
    </section>
  );
}

function wheelBackground(slotCount: number) {
  if (slotCount <= 0) {
    return "#dbe3dd";
  }

  const colors = ["#13795b", "#f2b84b", "#e66f4d", "#4267c9", "#7a5aa6", "#2f8fa5"];
  const slice = 360 / slotCount;

  return `conic-gradient(${Array.from({ length: slotCount }, (_, index) => {
    const start = index * slice;
    const end = (index + 1) * slice;
    return `${colors[index % colors.length]} ${start}deg ${end}deg`;
  }).join(", ")})`;
}
