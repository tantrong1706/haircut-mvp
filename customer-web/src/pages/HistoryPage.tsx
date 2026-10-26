import { useEffect, useState } from "react";
import { ClipboardList, RefreshCcw, Scissors } from "lucide-react";
import { getHaircutHistory } from "../services/api";
import { AppSession, HaircutRecord } from "../services/types";

type Props = { session: AppSession };

export function HistoryPage({ session }: Props) {
  const [records, setRecords] = useState<HaircutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setRecords([]);
    getHaircutHistory(session)
      .then(next => { if (!cancelled) setRecords(next); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Không tải được lịch sử cắt tóc"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loadVersion, session]);

  return (
    <section className="page history-page">
      <header className="page-header">
        <p className="eyebrow">Hồ sơ khách</p>
        <h1>Lịch sử cắt tóc</h1>
      </header>
      <div className="list">
        {loading ? (
          <div className="empty-state"><Scissors size={28} aria-hidden="true" /><strong>Đang tải lịch sử</strong><p>Vui lòng chờ trong giây lát.</p></div>
        ) : error ? (
          <div className="alert error retry-alert" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setLoadVersion(value => value + 1)}><RefreshCcw size={16} aria-hidden="true" />Thử lại</button>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state"><ClipboardList size={30} aria-hidden="true" /><strong>Chưa có lịch sử cắt tóc</strong><p>Sau khi nhân viên xác nhận, ngày cắt và điểm được cộng sẽ xuất hiện tại đây.</p></div>
        ) : records.map(record => (
          <article className="list-item" key={record.id}>
            <Scissors size={22} aria-hidden="true" />
            <div className="history-record-content"><strong>{record.createdAt || "Chưa có ngày"}</strong></div>
            <span className="pill" aria-label={`Đã cộng ${record.pointsAdded} điểm`}>+{record.pointsAdded}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
