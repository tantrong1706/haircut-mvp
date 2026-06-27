import { useEffect, useState } from "react";
import { getHaircutHistory } from "../services/api";
import { AppSession, HaircutRecord } from "../services/types";

type Props = {
  session: AppSession;
};

export function HistoryPage({ session }: Props) {
  const [records, setRecords] = useState<HaircutRecord[]>([]);

  useEffect(() => {
    getHaircutHistory(session).then(setRecords).catch(() => setRecords([]));
  }, [session]);

  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">Hồ sơ khách</p>
        <h1>Lịch sử cắt tóc</h1>
      </header>

      <div className="list">
        {records.length === 0 ? (
          <p className="empty">Chưa có lịch sử cắt tóc.</p>
        ) : (
          records.map((record) => (
            <article className="list-item" key={record.id}>
              <div>
                <strong>{record.createdAt}</strong>
                <p>{record.note}</p>
                <small>Thợ: {record.staffName}</small>
              </div>
              <span className="pill">+{record.pointsAdded}</span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

