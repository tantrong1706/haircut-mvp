import { useEffect, useState } from "react";
import { BadgeCheck, Gift, Ticket } from "lucide-react";
import { getRewards } from "../services/api";
import { AppSession, Reward } from "../services/types";

type Props = {
  session: AppSession;
};

export function RewardsPage({ session }: Props) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getRewards(session)
      .then((nextRewards) => {
        if (!cancelled) {
          setRewards(nextRewards);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRewards([]);
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
  }, [session]);

  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">Ưu đãi</p>
        <h1>Quà của tôi</h1>
      </header>

      <div className="list">
        {loading ? (
          <div className="empty-state">
            <Gift size={30} aria-hidden="true" />
            <strong>Đang tải mã quà</strong>
            <p>Danh sách ưu đãi của bạn sẽ hiện ở đây.</p>
          </div>
        ) : error ? (
          <p className="alert error">{error}</p>
        ) : rewards.length === 0 ? (
          <div className="empty-state">
            <Ticket size={30} aria-hidden="true" />
            <strong>Chưa có mã quà</strong>
            <p>Khi quay trúng thưởng, mã quà sẽ được lưu vào danh sách này.</p>
          </div>
        ) : (
          rewards.map((reward) => (
            <article className="list-item" key={reward.id}>
              <BadgeCheck size={22} aria-hidden="true" />
              <div>
                <strong>{reward.rewardName}</strong>
                <p>Mã: {reward.rewardCode}</p>
                <small>{reward.createdAt || "Chưa có ngày tạo"}</small>
              </div>
              <span className={reward.status === "unused" ? "pill" : "pill muted-pill"}>
                {statusLabel(reward.status)}
              </span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function statusLabel(status: Reward["status"]) {
  if (status === "used") {
    return "Đã sử dụng";
  }
  if (status === "expired") {
    return "Hết hạn";
  }
  return "Chưa sử dụng";
}
