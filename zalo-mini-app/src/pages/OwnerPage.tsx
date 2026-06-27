import { useEffect, useMemo, useState } from "react";
import {
  PointRequest,
  approvePointRequest,
  formatDateTime,
  listenPendingPointRequests,
  rejectPointRequest,
} from "../services/operations";

export function OwnerPage() {
  const salonId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("salonId") || "demo-salon";
  }, []);
  const [requests, setRequests] = useState<PointRequest[]>([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return listenPendingPointRequests(
      salonId,
      (nextRequests) => {
        setRequests(nextRequests);
        setError("");
      },
      setError,
    );
  }, [salonId]);

  async function approve(request: PointRequest) {
    setBusyId(request.id);
    setMessage("");
    setError("");

    try {
      await approvePointRequest(request);
      setMessage("Đã duyệt cộng điểm và lưu lịch sử cắt tóc.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không duyệt được yêu cầu");
    } finally {
      setBusyId("");
    }
  }

  async function reject(request: PointRequest) {
    setBusyId(request.id);
    setMessage("");
    setError("");

    try {
      await rejectPointRequest(request);
      setMessage("Đã từ chối yêu cầu.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không từ chối được yêu cầu");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="ops-page">
      <header className="page-header">
        <p className="eyebrow">Chủ salon</p>
        <h1>Duyệt cộng điểm</h1>
        <p className="muted">Salon: {salonId}</p>
      </header>

      <div className="ops-list">
        {requests.length === 0 ? (
          <p className="empty">Chưa có yêu cầu cộng điểm.</p>
        ) : (
          requests.map((request) => (
            <article className="ops-card static-card" key={request.id}>
              <span className="ops-card-title">{request.customer?.name || "Khách hàng"}</span>
              <span>
                SĐT:{" "}
                {request.customer?.phoneLast4 ? `******${request.customer.phoneLast4}` : "Chưa có"}
              </span>
              <span>Thợ: {request.staffName || "Nhân viên"}</span>
              <p>{request.note || "Không có ghi chú"}</p>
              <small>
                +{request.pointsAdded} điểm · {formatDateTime(request.createdAtMs)}
              </small>

              <div className="button-row">
                <button
                  className="primary-button compact"
                  disabled={busyId === request.id}
                  onClick={() => approve(request)}
                >
                  Duyệt
                </button>
                <button
                  className="secondary-button"
                  disabled={busyId === request.id}
                  onClick={() => reject(request)}
                >
                  Từ chối
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

