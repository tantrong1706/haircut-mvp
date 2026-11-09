import { useEffect, useState } from "react";
import { ClipboardList, RefreshCcw, Scissors } from "lucide-react";
import { getHaircutHistory } from "../services/api";
import { getWebCustomerVisitPhotos } from "../services/webCustomerApi";
import { AppSession, HaircutRecord } from "../services/types";

type Props = { session: AppSession };

export function HistoryPage({ session }: Props) {
  return (
    <CustomerHistory
      key={JSON.stringify([session.qr.salonId, session.firebaseUid, session.customer?.allowPhoto])}
      session={session}
    />
  );
}

function CustomerHistory({ session }: Props) {
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
            <div className="history-record-content">
              <strong>{record.createdAt || "Chưa có ngày"}</strong>
              {record.hasCustomerPhotos && session.customer?.allowPhoto !== false ? (
                <VisitPhotos session={session} recordId={record.id} date={record.createdAt} />
              ) : null}
            </div>
            <span className="pill" aria-label={`Đã cộng ${record.pointsAdded} điểm`}>+{record.pointsAdded}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function VisitPhotos({ session, recordId, date }: Props & { recordId: string; date: string }) {
  const [photos, setPhotos] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const open = photos !== null;
  const action = open ? "Ẩn ảnh" : failed ? "Thử lại" : "Xem ảnh";

  async function toggle() {
    if (open) {
      setPhotos(null);
      setFailed(false);
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      setPhotos(await getWebCustomerVisitPhotos(session, recordId));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="customer-visit-photos">
      <button type="button" aria-label={date ? `${action} ngày ${date}` : action}
        aria-expanded={open} disabled={busy} onClick={() => void toggle()}>
        {busy ? "Đang tải ảnh…" : action}
      </button>
      {failed ? <p role="status">Chưa tải được ảnh. Vui lòng thử lại.</p> : null}
      {photos?.length === 0 ? <p role="status">Ảnh của lượt cắt này không còn khả dụng.</p> : null}
      {photos?.length ? (
        <div className="customer-visit-photo-grid">
          {photos.map((url, index) => (
            <img key={url} src={url} alt={`Ảnh kiểu tóc ${index + 1}`} referrerPolicy="no-referrer"
              onError={() => { setPhotos(null); setFailed(true); }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
