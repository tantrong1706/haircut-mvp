import { useEffect, useMemo, useState } from "react";
import {
  PointRequest,
  approvePointRequest,
  formatDateTime,
  getLuckyWheelConfig,
  listenPendingPointRequests,
  rejectPointRequest,
  saveLuckyWheelConfig,
} from "../services/operations";
import { LuckyWheelConfig, defaultLuckyWheelConfig } from "../services/types";

type OwnerTab = "approvals" | "wheel";

export function OwnerPage() {
  const salonId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("salonId") || "demo-salon";
  }, []);
  const [activeTab, setActiveTab] = useState<OwnerTab>("approvals");
  const [requests, setRequests] = useState<PointRequest[]>([]);
  const [wheelConfig, setWheelConfig] = useState<LuckyWheelConfig>(defaultLuckyWheelConfig);
  const [busyId, setBusyId] = useState("");
  const [savingWheel, setSavingWheel] = useState(false);
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

  useEffect(() => {
    getLuckyWheelConfig(salonId)
      .then(setWheelConfig)
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được vòng quay"));
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

  async function saveWheel() {
    setSavingWheel(true);
    setMessage("");
    setError("");

    try {
      await saveLuckyWheelConfig(salonId, wheelConfig);
      setMessage("Đã lưu cấu hình vòng quay.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được vòng quay");
    } finally {
      setSavingWheel(false);
    }
  }

  return (
    <section className="ops-page">
      <header className="page-header">
        <p className="eyebrow">Chủ salon</p>
        <h1>Quản lý salon</h1>
        <p className="muted">Salon: {salonId}</p>
      </header>

      <div className="segmented-control" aria-label="Chọn mục quản lý">
        <button
          className={activeTab === "approvals" ? "active" : ""}
          onClick={() => setActiveTab("approvals")}
        >
          Duyệt điểm
        </button>
        <button
          className={activeTab === "wheel" ? "active" : ""}
          onClick={() => setActiveTab("wheel")}
        >
          Vòng quay
        </button>
      </div>

      {activeTab === "approvals" ? (
        <ApprovalsPanel
          requests={requests}
          busyId={busyId}
          onApprove={approve}
          onReject={reject}
        />
      ) : (
        <WheelConfigPanel
          config={wheelConfig}
          saving={savingWheel}
          onChange={setWheelConfig}
          onSave={saveWheel}
        />
      )}

      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function ApprovalsPanel({
  requests,
  busyId,
  onApprove,
  onReject,
}: {
  requests: PointRequest[];
  busyId: string;
  onApprove: (request: PointRequest) => void;
  onReject: (request: PointRequest) => void;
}) {
  return (
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
                onClick={() => onApprove(request)}
              >
                Duyệt
              </button>
              <button
                className="secondary-button"
                disabled={busyId === request.id}
                onClick={() => onReject(request)}
              >
                Từ chối
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function WheelConfigPanel({
  config,
  saving,
  onChange,
  onSave,
}: {
  config: LuckyWheelConfig;
  saving: boolean;
  onChange: (config: LuckyWheelConfig) => void;
  onSave: () => void;
}) {
  function updateSlot(index: number, label: string) {
    onChange({
      ...config,
      slots: config.slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, label } : slot,
      ),
    });
  }

  function toggleSlot(index: number, active: boolean) {
    onChange({
      ...config,
      slots: config.slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, active } : slot,
      ),
    });
  }

  return (
    <div className="panel">
      <div className="detail-stack">
        <label className="field">
          <span>Số điểm cần để quay</span>
          <input
            type="number"
            min={1}
            value={config.requiredPoints}
            onChange={(event) =>
              onChange({
                ...config,
                requiredPoints: Math.max(1, Number(event.target.value || 1)),
              })
            }
          />
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={config.deductPointsAfterSpin}
            onChange={(event) =>
              onChange({ ...config, deductPointsAfterSpin: event.target.checked })
            }
          />
          <span>Trừ điểm sau khi khách quay</span>
        </label>

        <div className="wheel-config-list">
          {config.slots.map((slot, index) => (
            <div className="wheel-slot-row" key={index}>
              <span>{index + 1}</span>
              <input
                value={slot.label}
                onChange={(event) => updateSlot(index, event.target.value)}
                placeholder={`Ô ${index + 1}`}
              />
              <label>
                <input
                  type="checkbox"
                  checked={slot.active}
                  onChange={(event) => toggleSlot(index, event.target.checked)}
                />
                Bật
              </label>
            </div>
          ))}
        </div>

        <button className="primary-button" disabled={saving} onClick={onSave}>
          {saving ? "Đang lưu..." : "Lưu vòng quay"}
        </button>
      </div>
    </div>
  );
}

