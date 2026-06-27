import { AppSession, TabKey } from "../services/types";

type Props = {
  session: AppSession;
  onTabChange: (tab: TabKey) => void;
};

export function HomePage({ session, onTabChange }: Props) {
  const { customer } = session;

  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">Xin chào</p>
        <h1>{customer.name}</h1>
        <p className="muted">
          SĐT: {customer.phoneLast4 ? `******${customer.phoneLast4}` : "Chưa cung cấp"}
        </p>
      </header>

      <div className="points-panel">
        <span>Điểm hiện tại</span>
        <strong>{customer.points}</strong>
      </div>

      <div className="quick-actions">
        <button onClick={() => onTabChange("history")}>Lịch sử cắt tóc</button>
        <button onClick={() => onTabChange("wheel")}>Vòng quay may mắn</button>
        <button onClick={() => onTabChange("rewards")}>Quà của tôi</button>
      </div>
    </section>
  );
}

