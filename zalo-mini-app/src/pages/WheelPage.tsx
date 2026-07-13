import { useEffect, useMemo, useState } from "react";
import { Gift, LockKeyhole, RefreshCcw, Sparkles, Ticket } from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { getCustomerWheelConfig, spinWheel } from "../services/api";
import { trackEvent, withMonitoringTrace } from "../services/monitoring";
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
  const [rotationDeg, setRotationDeg] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const slots = useMemo(() => activeWheelSlots(wheelConfig), [wheelConfig]);
  const missingPoints = Math.max(0, wheelConfig.requiredPoints - session.customer.points);
  const canSpin = !loadingConfig && !spinning && missingPoints === 0 && slots.length > 0;
  const wheelStyle = useMemo(
    () => ({
      background: wheelBackground(slots.length),
      transform: `rotate(${rotationDeg}deg)`,
    }),
    [rotationDeg, slots.length],
  );

  useEffect(() => {
    setLoadingConfig(true);
    getCustomerWheelConfig(session)
      .then((config) => {
        setWheelConfig(config);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Không tải được cấu hình vòng quay"),
      )
      .finally(() => setLoadingConfig(false));
  }, [loadVersion, session.sessionId]);

  async function handleSpin() {
    setSpinning(true);
    setResult(null);
    setError(null);
    trackEvent("lucky_wheel_spin_started", {
      salon_id: session.qr.salonId,
      points_before: session.customer.points,
      required_points: wheelConfig.requiredPoints,
    });
    try {
      const spinResult = await withMonitoringTrace("lucky_wheel_spin", () => spinWheel(session), {
        salon_id: session.qr.salonId,
      });
      const selectedIndex = selectedIndexFromResult(spinResult, slots);
      setRotationDeg((current) => nextRotation(current, selectedIndex, slots.length));
      await wait(1300);
      setResult({ ...spinResult, selectedIndex });
      onSessionChange({
        ...session,
        customer: {
          ...session.customer,
          points: spinResult.pointsAfter,
        },
      });
      trackEvent("lucky_wheel_spin_completed", {
        salon_id: session.qr.salonId,
        selected_index: selectedIndex,
        is_winning: spinResult.isWinning,
        points_after: spinResult.pointsAfter,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bạn chưa đủ điểm để quay");
    } finally {
      setSpinning(false);
    }
  }

  return (
    <section className="page">
      <header className="page-header premium-hero visual-hero wheel-hero">
        <div className="hero-topline">
          <BrandLogo />
          <span className="soft-chip">{session.customer.points} điểm</span>
        </div>
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
          {slots.map((slot, index) => {
            const angle =
              index * (360 / Math.max(slots.length, 1)) + 360 / Math.max(slots.length, 1) / 2;

            return (
              <span
                className="wheel-label"
                key={`${slot.label}-${index}`}
                style={{
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-108px) rotate(${-angle}deg)`,
                }}
              >
                {shortWheelLabel(slot.label)}
              </span>
            );
          })}
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

      <button className="primary-button" disabled={!canSpin} onClick={handleSpin}>
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

      {error ? (
        <div className="alert error retry-alert">
          <span>{error}</span>
          {loadingConfig ? null : (
            <button type="button" onClick={() => setLoadVersion((value) => value + 1)}>
              <RefreshCcw size={16} aria-hidden="true" />
              Tải lại
            </button>
          )}
        </div>
      ) : null}

      {result ? (
        <div className={`reward-result${result.isWinning ? "" : " no-prize"}`}>
          {result.isWinning ? (
            <Gift size={32} aria-hidden="true" />
          ) : (
            <Sparkles size={32} aria-hidden="true" />
          )}
          <p>{result.isWinning ? "Chúc mừng, bạn nhận được" : "Kết quả lượt quay"}</p>
          <strong>{result.rewardName}</strong>
          {result.isWinning ? (
            <>
              <span>Mã quà: {result.rewardCode}</span>
              <small>Hãy đưa mã này cho nhân viên khi sử dụng.</small>
            </>
          ) : (
            <small>Lượt này không tạo mã quà. Hẹn bạn ở lần quay tiếp theo.</small>
          )}
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

function selectedIndexFromResult(result: SpinResult, slots: Array<{ label: string }>) {
  if (
    typeof result.selectedIndex === "number" &&
    result.selectedIndex >= 0 &&
    result.selectedIndex < slots.length
  ) {
    return result.selectedIndex;
  }

  const foundIndex = slots.findIndex((slot) => slot.label === result.rewardName);
  return foundIndex >= 0 ? foundIndex : 0;
}

function nextRotation(currentRotation: number, selectedIndex: number, slotCount: number) {
  if (slotCount <= 0) {
    return currentRotation;
  }

  const slice = 360 / slotCount;
  const selectedCenter = selectedIndex * slice + slice / 2;
  const target = normalizeDegrees(270 - selectedCenter);
  const current = normalizeDegrees(currentRotation);
  return currentRotation + 1080 + normalizeDegrees(target - current);
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function shortWheelLabel(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("giảm 10")) return "-10%";
  if (normalized.includes("giảm 20")) return "-20%";
  if (normalized.includes("gội")) return "Gội đầu";
  if (normalized.includes("sáp")) return "Sáp tóc";
  if (normalized.includes("may mắn")) return "May mắn";
  if (normalized.includes("hấp")) return "Hấp dầu";
  if (label.length <= 10) return label;
  return `${label.slice(0, 9)}...`;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
