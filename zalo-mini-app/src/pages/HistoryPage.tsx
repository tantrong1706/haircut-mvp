import { useEffect, useState } from "react";
import { CalendarCheck2, ClipboardList, Scissors } from "lucide-react";
import { getHaircutHistory } from "../services/api";
import { AppSession, HaircutRecord } from "../services/types";

type Props = {
  session: AppSession;
};

export function HistoryPage({ session }: Props) {
  const [records, setRecords] = useState<HaircutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    getHaircutHistory(session)
      .then((nextRecords) => {
        if (!cancelled) {
          setRecords(nextRecords);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRecords([]);
          setError(err instanceof Error ? err.message : "Không tải được lịch sử cắt tóc");
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
        <p className="eyebrow">Hồ sơ khách</p>
        <h1>Lịch sử cắt tóc</h1>
      </header>

      <div className="list">
        {loading ? (
          <div className="empty-state">
            <Scissors size={28} aria-hidden="true" />
            <strong>Đang tải lịch sử</strong>
            <p>Vui lòng chờ trong giây lát.</p>
          </div>
        ) : error ? (
          <p className="alert error">{error}</p>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={30} aria-hidden="true" />
            <strong>Chưa có lịch sử cắt tóc</strong>
            <p>Sau khi chủ salon duyệt điểm, ghi chú kiểu tóc sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          records.map((record) => (
            <article className="list-item" key={record.id}>
              <CalendarCheck2 size={22} aria-hidden="true" />
              <div>
                <strong>{record.createdAt || "Chưa có ngày"}</strong>
                <p>{record.note || "Không có ghi chú kiểu tóc"}</p>
                <small>Nhân viên: {record.staffName || "Chưa rõ"}</small>
              </div>
              <span className="pill">+{record.pointsAdded}</span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
