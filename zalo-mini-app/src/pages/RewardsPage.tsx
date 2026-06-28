import { useEffect, useState } from "react";
import { getRewards } from "../services/api";
import { AppSession, Reward } from "../services/types";

type Props = {
  session: AppSession;
};

export function RewardsPage({ session }: Props) {
  const [rewards, setRewards] = useState<Reward[]>([]);

  useEffect(() => {
    getRewards(session).then(setRewards).catch(() => setRewards([]));
  }, [session]);

  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">Ưu đãi</p>
        <h1>Quà của tôi</h1>
      </header>

      <div className="list">
        {rewards.length === 0 ? (
          <p className="empty">Bạn chưa có mã quà.</p>
        ) : (
          rewards.map((reward) => (
            <article className="list-item" key={reward.id}>
              <div>
                <strong>{reward.rewardName}</strong>
                <p>Mã: {reward.rewardCode}</p>
                <small>{statusLabel(reward.status)}</small>
              </div>
              <span className="pill">{statusLabel(reward.status)}</span>
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
