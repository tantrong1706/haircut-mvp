import { useEffect, useMemo, useState } from "react";
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
      </header>

      <div className={spinning ? "wheel spinning" : "wheel"}>
        {slots.map((slot, index) => (
          <span
            key={`${slot.label}-${index}`}
            style={{ transform: `rotate(${index * (360 / Math.max(slots.length, 1))}deg)` }}
          >
            {slot.label}
          </span>
        ))}
      </div>

      <button
        className="primary-button"
        disabled={loadingConfig || spinning || missingPoints > 0 || slots.length === 0}
        onClick={handleSpin}
      >
        {loadingConfig ? "Đang tải vòng quay..." : spinning ? "Đang quay..." : "Quay ngay"}
      </button>

      {slots.length === 0 ? (
        <p className="muted">Salon chưa bật phần thưởng nào cho vòng quay.</p>
      ) : null}

      {missingPoints > 0 ? (
        <p className="muted">Bạn cần thêm {missingPoints} điểm để quay.</p>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      {result ? (
        <div className="reward-result">
          <p>Chúc mừng!</p>
          <strong>{result.rewardName}</strong>
          <span>Mã quà: {result.rewardCode}</span>
        </div>
      ) : null}
    </section>
  );
}
