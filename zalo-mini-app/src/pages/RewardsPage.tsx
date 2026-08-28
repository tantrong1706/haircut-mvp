import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Copy, Gift, History, RefreshCcw, Ticket } from "lucide-react";
import { getRewards } from "../services/api";
import { AppSession, Reward } from "../services/types";
import { RewardNavigation } from "../components/RewardNavigation";

type Props = {
  session: AppSession;
  onOpenWheel?: () => void;
};

export function RewardsPage({ session, onOpenWheel }: Props) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const activeRewards = useMemo(
    () => rewards.filter((reward) => reward.status === "unused"),
    [rewards],
  );
  const rewardHistory = useMemo(
    () => rewards.filter((reward) => reward.status !== "unused"),
    [rewards],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setCopyMessage("");

    getRewards(session)
      .then((nextRewards) => {
        if (!cancelled) {
          setRewards(nextRewards);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không tải được mã quà");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadVersion, session]);

  async function copyRewardCode(rewardCode: string) {
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(rewardCode);
      setCopyMessage("Đã sao chép mã quà.");
    } catch {
      setCopyMessage("Không thể sao chép tự động. Hãy giữ để chọn mã thủ công.");
    }
  }

  return (
    <section className="page rewards-page">
      <RewardNavigation active="rewards" onOpenWheel={onOpenWheel} />
      <header className="page-header">
        <p className="eyebrow">Ưu đãi</p>
        <h1>Quà của tôi</h1>
        <p className="muted">Mỗi mã ghi rõ chi nhánh áp dụng và chỉ được xác nhận một lần.</p>
      </header>

      <div className="rewards-content">
        {loading ? (
          <div className="empty-state">
            <Gift size={30} aria-hidden="true" />
            <strong>Đang tải mã quà</strong>
            <p>Danh sách ưu đãi của bạn sẽ hiện ở đây.</p>
          </div>
        ) : error ? (
          <div className="alert error retry-alert">
            <span>{error}</span>
            <button type="button" onClick={() => setLoadVersion((value) => value + 1)}>
              <RefreshCcw size={16} aria-hidden="true" />
              Thử lại
            </button>
          </div>
        ) : rewards.length === 0 ? (
          <div className="empty-state">
            <Ticket size={30} aria-hidden="true" />
            <strong>Chưa có mã quà</strong>
            <p>Khi quay trúng thưởng, mã quà sẽ được lưu vào danh sách này.</p>
          </div>
        ) : (
          <>
            {activeRewards.length > 0 ? (
              <section className="reward-section" role="region" aria-label="Quà có thể sử dụng">
                <div className="reward-section-heading">
                  <Ticket size={20} aria-hidden="true" />
                  <div>
                    <h2>Quà có thể sử dụng</h2>
                    <p>Đưa mã cho nhân viên sau khi nhận đúng ưu đãi.</p>
                  </div>
                </div>
                <div className="list">
                  {activeRewards.map((reward) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      onCopy={() => copyRewardCode(reward.rewardCode)}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <div className="empty-state compact-empty">
                <Ticket size={30} aria-hidden="true" />
                <strong>Không có quà đang hiệu lực</strong>
                <p>Các mã đã dùng, hết hạn hoặc bị hủy được lưu ở lịch sử bên dưới.</p>
              </div>
            )}

            {copyMessage ? <p className="alert success">{copyMessage}</p> : null}

            {rewardHistory.length > 0 ? (
              <section className="reward-section" role="region" aria-label="Lịch sử quà">
                <div className="reward-section-heading history-heading">
                  <History size={20} aria-hidden="true" />
                  <div>
                    <h2>Lịch sử quà</h2>
                    <p>Mã đã dùng, hết hạn hoặc bị hủy không thể sử dụng lại.</p>
                  </div>
                </div>
                <div className="list reward-history-list">
                  {rewardHistory.map((reward) => (
                    <RewardCard key={reward.id} reward={reward} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function RewardCard({ reward, onCopy }: { reward: Reward; onCopy?: () => void }) {
  const active = reward.status === "unused";
  return (
    <article className={`list-item reward-card${active ? " active-reward" : " past-reward"}`}>
      <BadgeCheck size={22} aria-hidden="true" />
      <div className="reward-card-content">
        <strong>{reward.rewardName}</strong>
        <p className={active ? "reward-code" : "reward-code masked-code"}>
          {active ? `Mã: ${reward.rewardCode}` : `Mã kết thúc: ${reward.rewardCode.slice(-4)}`}
        </p>
        <small>Nhận ngày: {reward.createdAt || "Chưa rõ"}</small>
        {reward.expiresAt ? <small>Hạn dùng: {reward.expiresAt}</small> : null}
        {reward.usedAt ? <small>Đã dùng ngày: {reward.usedAt}</small> : null}
        <small className="usage-note">
          Chỉ dùng tại: {reward.branchName || "Chi nhánh đã phát hành"}
        </small>
        {active ? <small>Nhân viên sẽ kiểm tra và xác nhận sau khi trao ưu đãi.</small> : null}
        {active && onCopy ? (
          <button className="reward-copy-button" type="button" onClick={onCopy}>
            <Copy size={16} aria-hidden="true" />
            Sao chép mã quà
          </button>
        ) : null}
      </div>
      <span className={active ? "pill" : "pill muted-pill"}>{statusLabel(reward.status)}</span>
    </article>
  );
}

function statusLabel(status: Reward["status"]) {
  if (status === "used") {
    return "Đã dùng";
  }
  if (status === "expired") {
    return "Hết hạn";
  }
  if (status === "revoked") {
    return "Đã hủy";
  }
  return "Có thể dùng";
}
