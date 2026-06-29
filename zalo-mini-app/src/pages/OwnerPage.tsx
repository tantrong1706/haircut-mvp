import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Gift,
  RefreshCcw,
  Save,
  Settings2,
  SlidersHorizontal,
  TicketCheck,
  UsersRound,
  XCircle,
} from "lucide-react";
import { RedeemRewardPanel } from "../components/RedeemRewardPanel";
import {
  OwnerOverview,
  PointRequest,
  approvePointRequest,
  formatDateTime,
  getLuckyWheelConfig,
  getOwnerOverview,
  listenPendingPointRequests,
  rejectPointRequest,
  saveLuckyWheelConfig,
} from "../services/operations";
import { AppUser } from "../services/auth";
import { LuckyWheelConfig, defaultLuckyWheelConfig } from "../services/types";

type OwnerTab = "overview" | "approvals" | "wheel" | "redeem";

type Props = {
  currentUser: AppUser;
};

export function OwnerPage({ currentUser }: Props) {
  const salonId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return currentUser.salonId || params.get("salonId") || "demo-salon";
  }, [currentUser.salonId]);
  const [activeTab, setActiveTab] = useState<OwnerTab>("overview");
  const [requests, setRequests] = useState<PointRequest[]>([]);
  const [overview, setOverview] = useState<OwnerOverview | null>(null);
  const [wheelConfig, setWheelConfig] = useState<LuckyWheelConfig>(defaultLuckyWheelConfig);
  const [busyId, setBusyId] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(true);
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

  useEffect(() => {
    refreshOverview();
  }, [salonId]);

  async function refreshOverview() {
    setLoadingOverview(true);
    try {
      setOverview(await getOwnerOverview(salonId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được tổng quan");
    } finally {
      setLoadingOverview(false);
    }
  }

  async function approve(request: PointRequest) {
    const ok = window.confirm(
      `Duyệt cộng ${request.pointsAdded} điểm cho ${request.customer?.name || "khách hàng"}?`,
    );
    if (!ok) {
      return;
    }

    setBusyId(request.id);
    setMessage("");
    setError("");

    try {
      await approvePointRequest(request);
      refreshOverview();
      setMessage("Đã duyệt cộng điểm và lưu lịch sử cắt tóc.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không duyệt được yêu cầu");
    } finally {
      setBusyId("");
    }
  }

  async function reject(request: PointRequest) {
    const ok = window.confirm(
      `Từ chối yêu cầu cộng điểm của ${request.customer?.name || "khách hàng"}?`,
    );
    if (!ok) {
      return;
    }

    setBusyId(request.id);
    setMessage("");
    setError("");

    try {
      await rejectPointRequest(request);
      refreshOverview();
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

      <div className="metrics-row">
        <div className="metric-card">
          <ClipboardCheck size={20} aria-hidden="true" />
          <span>Chờ duyệt</span>
          <strong>{requests.length}</strong>
        </div>
        <div className="metric-card">
          <Gift size={20} aria-hidden="true" />
          <span>Ô đang bật</span>
          <strong>{wheelConfig.slots.filter((slot) => slot.active).length}</strong>
        </div>
      </div>

      <div className="segmented-control owner-tabs" aria-label="Chọn mục quản lý">
        <button
          className={activeTab === "overview" ? "active" : ""}
          onClick={() => setActiveTab("overview")}
        >
          <BarChart3 size={18} aria-hidden="true" />
          Tổng quan
        </button>
        <button
          className={activeTab === "approvals" ? "active" : ""}
          onClick={() => setActiveTab("approvals")}
        >
          <ClipboardCheck size={18} aria-hidden="true" />
          Duyệt điểm
        </button>
        <button
          className={activeTab === "wheel" ? "active" : ""}
          onClick={() => setActiveTab("wheel")}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          Vòng quay
        </button>
        <button
          className={activeTab === "redeem" ? "active" : ""}
          onClick={() => setActiveTab("redeem")}
        >
          <TicketCheck size={18} aria-hidden="true" />
          Đổi quà
        </button>
      </div>

      {activeTab === "overview" ? (
        <OverviewPanel overview={overview} loading={loadingOverview} onRefresh={refreshOverview} />
      ) : activeTab === "approvals" ? (
        <ApprovalsPanel
          requests={requests}
          busyId={busyId}
          onApprove={approve}
          onReject={reject}
        />
      ) : activeTab === "wheel" ? (
        <WheelConfigPanel
          config={wheelConfig}
          saving={savingWheel}
          onChange={setWheelConfig}
          onSave={saveWheel}
        />
      ) : (
        <RedeemRewardPanel salonId={salonId} />
      )}

      {message ? <p className="alert success">{message}</p> : null}
      {error ? <p className="alert error">{error}</p> : null}
    </section>
  );
}

function OverviewPanel({
  overview,
  loading,
  onRefresh,
}: {
  overview: OwnerOverview | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const data =
    overview ||
    ({
      customersToday: 0,
      pendingRequests: 0,
      pointsApprovedToday: 0,
      spinsToday: 0,
      unusedRewards: 0,
    } satisfies OwnerOverview);

  return (
    <div className="panel overview-panel">
      <div className="section-heading">
        <BarChart3 size={22} aria-hidden="true" />
        <div>
          <h2>Tổng quan hôm nay</h2>
          <p className="muted">Các số liệu nhanh để chủ salon biết việc cần xử lý.</p>
        </div>
      </div>

      <div className="overview-grid">
        <OverviewMetric
          icon={<UsersRound size={21} />}
          label="Khách hôm nay"
          value={data.customersToday}
        />
        <OverviewMetric
          icon={<ClipboardCheck size={21} />}
          label="Chờ duyệt"
          value={data.pendingRequests}
        />
        <OverviewMetric
          icon={<CheckCircle2 size={21} />}
          label="Điểm đã cộng"
          value={data.pointsApprovedToday}
        />
        <OverviewMetric icon={<Gift size={21} />} label="Lượt quay" value={data.spinsToday} />
        <OverviewMetric
          icon={<TicketCheck size={21} />}
          label="Mã quà chưa dùng"
          value={data.unusedRewards}
        />
      </div>

      <button className="secondary-button" disabled={loading} onClick={onRefresh}>
        <RefreshCcw size={18} aria-hidden="true" />
        {loading ? "Đang tải..." : "Làm mới tổng quan"}
      </button>
    </div>
  );
}

function OverviewMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="overview-metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
        <div className="empty-state">
          <ClipboardCheck size={30} aria-hidden="true" />
          <strong>Chưa có yêu cầu cộng điểm</strong>
          <p>Khi nhân viên gửi yêu cầu sau khi cắt, chủ salon sẽ duyệt tại đây.</p>
        </div>
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
                <CheckCircle2 size={18} aria-hidden="true" />
                Duyệt
              </button>
              <button
                className="secondary-button"
                disabled={busyId === request.id}
                onClick={() => onReject(request)}
              >
                <XCircle size={18} aria-hidden="true" />
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
        <div className="section-heading">
          <Settings2 size={22} aria-hidden="true" />
          <div>
            <h2>Cấu hình vòng quay</h2>
            <p className="muted">Chủ salon có thể đổi điểm cần quay và nội dung từng ô.</p>
          </div>
        </div>

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

        <div className="wheel-config-list" aria-label="Danh sách ô vòng quay">
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
          {saving ? (
            "Đang lưu..."
          ) : (
            <>
              <Save size={20} aria-hidden="true" />
              Lưu vòng quay
            </>
          )}
        </button>
      </div>
    </div>
  );
}
