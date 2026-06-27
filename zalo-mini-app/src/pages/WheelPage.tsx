import { useState } from "react";
import { spinWheel } from "../services/api";
import { AppSession, SpinResult } from "../services/types";

type Props = {
  session: AppSession;
  onSessionChange: (session: AppSession) => void;
};

const wheelSlots = [
  "Giảm 10%",
  "Gội miễn phí",
  "Tặng sáp",
  "Giảm 20%",
  "Chúc may mắn",
  "Hấp dầu",
];

export function WheelPage({ session, onSessionChange }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <p className="eyebrow">Đủ 5 điểm để quay</p>
        <h1>Vòng quay may mắn</h1>
      </header>

      <div className={spinning ? "wheel spinning" : "wheel"}>
        {wheelSlots.map((slot, index) => (
          <span key={slot} style={{ transform: `rotate(${index * 60}deg)` }}>
            {slot}
          </span>
        ))}
      </div>

      <button
        className="primary-button"
        disabled={spinning || session.customer.points < 5}
        onClick={handleSpin}
      >
        {spinning ? "Đang quay..." : "Quay ngay"}
      </button>

      {session.customer.points < 5 ? (
        <p className="muted">Bạn cần thêm {5 - session.customer.points} điểm để quay.</p>
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
