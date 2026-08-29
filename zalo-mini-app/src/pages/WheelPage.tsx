import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gift, LockKeyhole, RefreshCcw, Sparkles, Ticket } from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { RewardNavigation } from "../components/RewardNavigation";
import { MINI_APP_MARK } from "../config/branding";
import { getCustomerWheelConfig, spinWheel } from "../services/api";
import { trackEvent, withMonitoringTrace } from "../services/monitoring";
import {
  AppSession,
  LuckyWheelConfig,
  SpinResult,
  defaultLuckyWheelConfig,
} from "../services/types";
import {
  WHEEL_ANIMATION_DURATION_MS,
  type WheelAnimationPlan,
  activeWheelSlots,
  createWheelAnimationPlan,
  targetWheelRotation,
} from "../services/wheel";

type Props = {
  session: AppSession;
  onSessionChange: (session: AppSession) => void;
  onOpenRewards?: () => void;
};

export function WheelPage({ session, onSessionChange, onOpenRewards }: Props) {
  const [wheelConfig, setWheelConfig] = useState<LuckyWheelConfig>(defaultLuckyWheelConfig);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [animationPlan, setAnimationPlan] = useState<WheelAnimationPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const spinLockRef = useRef(false);
  const animationResolveRef = useRef<(() => void) | null>(null);
  const animationTimeoutRef = useRef<number | null>(null);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const sessionKey = `${session.qr.salonId}:${session.customer.customerId}:${session.sessionId}`;
  const activeSessionKeyRef = useRef(sessionKey);
  const slots = useMemo(() => activeWheelSlots(wheelConfig), [wheelConfig]);
  const missingPoints = Math.max(0, wheelConfig.requiredPoints - session.customer.points);
  const wheelUnavailable =
    session.features?.maintenanceMode === true || session.features?.luckyWheelEnabled === false;
  const canSpin =
    !wheelUnavailable && !loadingConfig && !spinning && missingPoints === 0 && slots.length > 0;
  const wheelStyle = useMemo(() => {
    const visualRotation = animationPlan?.to ?? rotationDeg;
    const style: CSSProperties &
      Record<`--wheel-angle-${number}`, string> & { "--wheel-label-counter": string } = {
      background: wheelBackground(slots.length),
      transform: `rotate(${rotationDeg}deg)`,
      "--wheel-label-counter": `${-visualRotation}deg`,
    };
    animationPlan?.angles.forEach((angle, index) => {
      style[`--wheel-angle-${index}`] = `${angle}deg`;
    });
    return style;
  }, [animationPlan, rotationDeg, slots.length]);

  const finishWheelAnimation = useCallback(() => {
    const resolve = animationResolveRef.current;
    if (!resolve) return;
    animationResolveRef.current = null;
    if (animationTimeoutRef.current !== null) {
      window.clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
    resolve();
  }, []);

  useEffect(() => {
    if (!animationPlan || !wheelRef.current) return;
    const wheel = wheelRef.current;
    wheel.addEventListener("animationend", finishWheelAnimation);
    return () => wheel.removeEventListener("animationend", finishWheelAnimation);
  }, [animationPlan, finishWheelAnimation]);

  useEffect(() => {
    activeSessionKeyRef.current = sessionKey;
    finishWheelAnimation();
    spinLockRef.current = false;
    setSpinning(false);
    setResult(null);
    setRotationDeg(0);
    setAnimationPlan(null);
    setError(null);
    setStaleNotice(null);
  }, [finishWheelAnimation, sessionKey]);

  useEffect(() => {
    let cancelled = false;
    setLoadingConfig(true);
    getCustomerWheelConfig(session)
      .then((config) => {
        if (!cancelled) {
          setWheelConfig(config);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không tải được cấu hình vòng quay");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingConfig(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadVersion, sessionKey]);

  async function handleSpin() {
    if (spinLockRef.current) return;
    spinLockRef.current = true;
    setSpinning(true);
    setResult(null);
    setError(null);
    setStaleNotice(null);
    const spinSessionKey = sessionKey;
    trackEvent("lucky_wheel_spin_started", {
      salon_id: session.qr.salonId,
      points_before: session.customer.points,
      required_points: wheelConfig.requiredPoints,
    });
    try {
      const spinResult = await withMonitoringTrace(
        "lucky_wheel_spin",
        () => spinWheel(session, wheelConfig.configVersion),
        {
          salon_id: session.qr.salonId,
        },
      );
      if (activeSessionKeyRef.current !== spinSessionKey) return;
      const selectedIndex = selectedIndexFromResult(
        spinResult,
        slots,
        wheelConfig.configVersion,
      );
      const targetRotation = targetWheelRotation(rotationDeg, selectedIndex, slots.length);
      await playWheelAnimation(createWheelAnimationPlan(rotationDeg, targetRotation));
      if (activeSessionKeyRef.current !== spinSessionKey) return;
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
      const message = err instanceof Error ? err.message : "Bạn chưa đủ điểm để quay";
      if (message.includes("Vòng quay vừa được cập nhật")) {
        setStaleNotice("Vòng quay vừa được cập nhật. Vui lòng quay lại.");
        setLoadVersion((value) => value + 1);
      } else {
        setError(message);
      }
    } finally {
      spinLockRef.current = false;
      setSpinning(false);
    }
  }

  function playWheelAnimation(plan: WheelAnimationPlan) {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setRotationDeg(plan.to);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      animationResolveRef.current = () => {
        setRotationDeg(plan.to);
        setAnimationPlan(null);
        resolve();
      };
      setAnimationPlan(plan);
      animationTimeoutRef.current = window.setTimeout(
        finishWheelAnimation,
        WHEEL_ANIMATION_DURATION_MS + 750,
      );
    });
  }

  return (
    <section className="page">
      <RewardNavigation active="wheel" onOpenRewards={onOpenRewards} />
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
        <div
          ref={wheelRef}
          className={`wheel${spinning ? " spinning" : ""}${animationPlan ? " animating" : ""}`}
          data-testid="lucky-wheel"
          data-rotation={animationPlan?.to ?? rotationDeg}
          style={wheelStyle}
        >
          {slots.map((slot, index) => {
            const angle =
              index * (360 / Math.max(slots.length, 1)) + 360 / Math.max(slots.length, 1) / 2;

            return (
              <span
                className="wheel-label"
                key={`${slot.label}-${index}`}
                style={{
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-108px) rotate(${-angle}deg) rotate(var(--wheel-label-counter))`,
                }}
              >
                {shortWheelLabel(slot.label)}
              </span>
            );
          })}
          <div className="wheel-center">
            <Sparkles size={26} aria-hidden="true" />
            <span>{MINI_APP_MARK}</span>
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
        {wheelUnavailable ? (
          "Vòng quay đang tạm ngừng"
        ) : loadingConfig ? (
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

      {wheelUnavailable ? (
        <p className="alert error" role="status">
          {session.features?.maintenanceMode
            ? "Hệ thống đang bảo trì. Vui lòng quay lại sau."
            : "Salon đang tạm ngừng vòng quay."}
        </p>
      ) : null}

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

      {staleNotice ? <p className="alert warning">{staleNotice}</p> : null}

      {result ? (
        <div className={`reward-result${result.isWinning ? "" : " no-prize"}`}>
          {result.isWinning ? (
            <Gift size={32} aria-hidden="true" />
          ) : (
            <Sparkles size={32} aria-hidden="true" />
          )}
          <p>Kết quả lượt vừa quay</p>
          <strong>{result.rewardName}</strong>
          {result.isWinning ? (
            <>
              <span>Mã quà đã được lưu trong Quà của tôi.</span>
              <small>Mặc định dùng tại mọi chi nhánh cùng salon; xem chi tiết trong tab Quà.</small>
              {onOpenRewards ? (
                <button className="secondary-button compact" type="button" onClick={onOpenRewards}>
                  <Ticket size={17} aria-hidden="true" />
                  Xem quà của tôi
                </button>
              ) : null}
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

function selectedIndexFromResult(
  result: SpinResult,
  slots: Array<{ slotId: string }>,
  configVersion: number,
) {
  if (
    Number.isSafeInteger(result.selectedIndex) &&
    result.selectedIndex >= 0 &&
    result.selectedIndex < slots.length &&
    result.configVersion === configVersion &&
    result.selectedSlotId === slots[result.selectedIndex].slotId
  ) {
    return result.selectedIndex;
  }
  throw new Error("Vòng quay vừa được cập nhật. Vui lòng quay lại.");
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
