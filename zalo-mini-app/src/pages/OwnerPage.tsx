import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Gift,
  Power,
  QrCode,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  TicketCheck,
  UserPlus,
  UsersRound,
  XCircle,
} from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { RedeemRewardPanel } from "../components/RedeemRewardPanel";
import {
  CustomerLookupResult,
  SalonMirror,
  OwnerOverview,
  PointRequest,
  StaffProfile,
  approvePointRequest,
  createMirror,
  createStaffProfile,
  formatDateTime,
  getLuckyWheelConfig,
  getMirrors,
  getOwnerOverview,
  getStaffProfiles,
  listenPendingPointRequests,
  rejectPointRequest,
  saveLuckyWheelConfig,
  searchSalonCustomers,
  updateMirror,
  updateStaffProfile,
} from "../services/operations";
import { AppUser } from "../services/auth";
import { LuckyWheelConfig, defaultLuckyWheelConfig } from "../services/types";

type OwnerTab = "overview" | "approvals" | "mirrors" | "staff" | "customers" | "wheel" | "redeem";

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
      <header className="page-header premium-hero ops-hero">
        <div className="hero-topline">
          <BrandLogo />
          <span className="soft-chip">Bảng điều hành</span>
        </div>
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
        <OwnerTabButton
          active={activeTab === "overview"}
          icon={<BarChart3 size={18} />}
          label="Tổng quan"
          onClick={() => setActiveTab("overview")}
        />
        <OwnerTabButton
          active={activeTab === "approvals"}
          icon={<ClipboardCheck size={18} />}
          label="Duyệt điểm"
          onClick={() => setActiveTab("approvals")}
        />
        <OwnerTabButton
          active={activeTab === "mirrors"}
          icon={<QrCode size={18} />}
          label="Gương QR"
          onClick={() => setActiveTab("mirrors")}
        />
        <OwnerTabButton
          active={activeTab === "staff"}
          icon={<UsersRound size={18} />}
          label="Nhân viên"
          onClick={() => setActiveTab("staff")}
        />
        <OwnerTabButton
          active={activeTab === "customers"}
          icon={<Search size={18} />}
          label="Tìm khách"
          onClick={() => setActiveTab("customers")}
        />
        <OwnerTabButton
          active={activeTab === "wheel"}
          icon={<SlidersHorizontal size={18} />}
          label="Vòng quay"
          onClick={() => setActiveTab("wheel")}
        />
        <OwnerTabButton
          active={activeTab === "redeem"}
          icon={<TicketCheck size={18} />}
          label="Đổi quà"
          onClick={() => setActiveTab("redeem")}
        />
      </div>

      {activeTab === "overview" ? (
        <OverviewPanel
          overview={overview}
          loading={loadingOverview}
          onRefresh={refreshOverview}
          onOpenTab={setActiveTab}
        />
      ) : activeTab === "approvals" ? (
        <ApprovalsPanel
          requests={requests}
          busyId={busyId}
          onApprove={approve}
          onReject={reject}
        />
      ) : activeTab === "mirrors" ? (
        <MirrorsPanel salonId={salonId} onMessage={setMessage} onError={setError} />
      ) : activeTab === "staff" ? (
        <StaffManagementPanel salonId={salonId} onMessage={setMessage} onError={setError} />
      ) : activeTab === "customers" ? (
        <CustomerSearchPanel salonId={salonId} onMessage={setMessage} onError={setError} />
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

function OwnerTabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function OverviewPanel({
  overview,
  loading,
  onRefresh,
  onOpenTab,
}: {
  overview: OwnerOverview | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenTab: (tab: OwnerTab) => void;
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

      <div className="owner-next-actions">
        <button type="button" onClick={() => onOpenTab("approvals")}>
          <ClipboardCheck size={20} aria-hidden="true" />
          <span>
            <strong>Duyệt điểm</strong>
            <small>
              {data.pendingRequests > 0
                ? `${data.pendingRequests} yêu cầu đang chờ`
                : "Chưa có yêu cầu mới"}
            </small>
          </span>
        </button>
        <button type="button" onClick={() => onOpenTab("redeem")}>
          <TicketCheck size={20} aria-hidden="true" />
          <span>
            <strong>Đổi mã quà</strong>
            <small>
              {data.unusedRewards > 0
                ? `${data.unusedRewards} mã chưa dùng`
                : "Sẵn sàng xác nhận mã mới"}
            </small>
          </span>
        </button>
        <button type="button" onClick={() => onOpenTab("wheel")}>
          <SlidersHorizontal size={20} aria-hidden="true" />
          <span>
            <strong>Cấu hình vòng quay</strong>
            <small>Đổi điểm quay và 6 ô thưởng</small>
          </span>
        </button>
        <button type="button" onClick={() => onOpenTab("mirrors")}>
          <QrCode size={20} aria-hidden="true" />
          <span>
            <strong>Gương QR</strong>
            <small>Tạo link QR riêng cho từng gương/ghế</small>
          </span>
        </button>
        <button type="button" onClick={() => onOpenTab("staff")}>
          <UserPlus size={20} aria-hidden="true" />
          <span>
            <strong>Nhân viên</strong>
            <small>Thêm, tắt và cấp quyền đổi quà</small>
          </span>
        </button>
        <button type="button" onClick={() => onOpenTab("customers")}>
          <Search size={20} aria-hidden="true" />
          <span>
            <strong>Tìm khách</strong>
            <small>Tra điểm, lịch sử và mã quà chưa dùng</small>
          </span>
        </button>
      </div>
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
          <article className="ops-card static-card approval-card" key={request.id}>
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

function MirrorsPanel({
  salonId,
  onMessage,
  onError,
}: {
  salonId: string;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [mirrors, setMirrors] = useState<SalonMirror[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    refresh();
  }, [salonId]);

  async function refresh() {
    setLoading(true);
    try {
      setMirrors(await getMirrors(salonId));
      onError("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tải được danh sách gương");
    } finally {
      setLoading(false);
    }
  }

  async function addMirror() {
    setBusyId("new");
    onMessage("");
    onError("");

    try {
      await createMirror({ salonId, name });
      setName("");
      await refresh();
      onMessage("Đã tạo QR gương mới.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tạo được QR gương");
    } finally {
      setBusyId("");
    }
  }

  async function saveMirror(mirror: SalonMirror, payload: Partial<SalonMirror> & { regenerateQr?: boolean }) {
    setBusyId(mirror.id);
    onMessage("");
    onError("");

    try {
      await updateMirror({
        salonId,
        mirrorId: mirror.id,
        name: payload.name,
        isActive: payload.isActive,
        regenerateQr: payload.regenerateQr,
      });
      await refresh();
      onMessage(payload.regenerateQr ? "Đã tạo lại QR mới cho gương." : "Đã cập nhật gương.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không cập nhật được gương");
    } finally {
      setBusyId("");
    }
  }

  async function copyQr(url: string) {
    await navigator.clipboard.writeText(url);
    onMessage("Đã copy link QR.");
  }

  return (
    <div className="panel">
      <div className="section-heading">
        <QrCode size={22} aria-hidden="true" />
        <div>
          <h2>Quản lý gương QR</h2>
          <p className="muted">Mỗi gương/ghế có một link QR riêng để khách check-in đúng vị trí.</p>
        </div>
      </div>

      <div className="inline-form">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ví dụ: Gương 1, Gương 2, Ghế VIP"
        />
        <button className="primary-button" disabled={busyId === "new" || !name.trim()} onClick={addMirror}>
          <QrCode size={18} aria-hidden="true" />
          Tạo QR
        </button>
      </div>

      <div className="ops-list">
        {loading ? (
          <div className="empty-state compact-empty">
            <QrCode size={28} aria-hidden="true" />
            <strong>Đang tải gương</strong>
            <p>Danh sách QR sẽ hiện sau vài giây.</p>
          </div>
        ) : mirrors.length === 0 ? (
          <div className="empty-state compact-empty">
            <QrCode size={28} aria-hidden="true" />
            <strong>Chưa có gương QR</strong>
            <p>Tạo gương đầu tiên để khách có link check-in.</p>
          </div>
        ) : (
          mirrors.map((mirror) => (
            <MirrorCard
              key={mirror.id}
              mirror={mirror}
              busy={busyId === mirror.id}
              onCopy={copyQr}
              onSave={saveMirror}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MirrorCard({
  mirror,
  busy,
  onCopy,
  onSave,
}: {
  mirror: SalonMirror;
  busy: boolean;
  onCopy: (url: string) => void;
  onSave: (mirror: SalonMirror, payload: Partial<SalonMirror> & { regenerateQr?: boolean }) => void;
}) {
  const [name, setName] = useState(mirror.name);

  useEffect(() => {
    setName(mirror.name);
  }, [mirror.name]);

  return (
    <article className="ops-card static-card management-card">
      <div className="management-card-header">
        <span className="ops-card-title">{mirror.name}</span>
        <span className={mirror.isActive ? "pill" : "pill muted-pill"}>
          {mirror.isActive ? "Đang bật" : "Đã tắt"}
        </span>
      </div>
      <label className="field compact-field">
        <span>Tên gương/ghế</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <p className="qr-url">{mirror.qrUrl}</p>
      <div className="button-row wrap-row">
        <button className="secondary-button" onClick={() => onCopy(mirror.qrUrl)}>
          <Copy size={18} aria-hidden="true" />
          Copy link
        </button>
        <button className="secondary-button" disabled={busy} onClick={() => onSave(mirror, { name })}>
          <Save size={18} aria-hidden="true" />
          Lưu tên
        </button>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => onSave(mirror, { isActive: !mirror.isActive })}
        >
          <Power size={18} aria-hidden="true" />
          {mirror.isActive ? "Tắt QR" : "Bật QR"}
        </button>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Tạo lại QR mới? QR cũ sẽ không còn dùng được.")) {
              onSave(mirror, { regenerateQr: true });
            }
          }}
        >
          <RefreshCcw size={18} aria-hidden="true" />
          Tạo QR mới
        </button>
      </div>
    </article>
  );
}

function StaffManagementPanel({
  salonId,
  onMessage,
  onError,
}: {
  salonId: string;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [uid, setUid] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [canRedeemRewards, setCanRedeemRewards] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    refresh();
  }, [salonId]);

  async function refresh() {
    setLoading(true);
    try {
      setStaff(await getStaffProfiles(salonId));
      onError("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tải được nhân viên");
    } finally {
      setLoading(false);
    }
  }

  async function addStaff() {
    setBusyId("new");
    onMessage("");
    onError("");

    try {
      await createStaffProfile({ salonId, uid, name, phone, canRedeemRewards });
      setUid("");
      setName("");
      setPhone("");
      setCanRedeemRewards(false);
      await refresh();
      onMessage("Đã thêm nhân viên.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không thêm được nhân viên");
    } finally {
      setBusyId("");
    }
  }

  async function saveStaff(staffMember: StaffProfile, payload: Partial<StaffProfile>) {
    setBusyId(staffMember.uid);
    onMessage("");
    onError("");

    try {
      await updateStaffProfile({
        salonId,
        uid: staffMember.uid,
        name: payload.name,
        phone: payload.phone,
        isActive: payload.isActive,
        canRedeemRewards: payload.canRedeemRewards,
      });
      await refresh();
      onMessage("Đã cập nhật nhân viên.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không cập nhật được nhân viên");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="panel">
      <div className="section-heading">
        <UserPlus size={22} aria-hidden="true" />
        <div>
          <h2>Quản lý nhân viên</h2>
          <p className="muted">Thêm nhân viên bằng UID Firebase Auth, bật/tắt tài khoản và quyền đổi mã quà.</p>
        </div>
      </div>

      <div className="staff-create-grid">
        <input value={uid} onChange={(event) => setUid(event.target.value)} placeholder="UID nhân viên" />
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tên nhân viên" />
        <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="SĐT nội bộ" />
        <label className="toggle-row inline-toggle">
          <input
            type="checkbox"
            checked={canRedeemRewards}
            onChange={(event) => setCanRedeemRewards(event.target.checked)}
          />
          <span>Cho đổi mã quà</span>
        </label>
        <button className="primary-button" disabled={busyId === "new" || !uid.trim() || !name.trim()} onClick={addStaff}>
          <UserPlus size={18} aria-hidden="true" />
          Thêm
        </button>
      </div>

      <div className="ops-list">
        {loading ? (
          <div className="empty-state compact-empty">
            <UsersRound size={28} aria-hidden="true" />
            <strong>Đang tải nhân viên</strong>
            <p>Danh sách tài khoản sẽ hiện ở đây.</p>
          </div>
        ) : staff.length === 0 ? (
          <div className="empty-state compact-empty">
            <UsersRound size={28} aria-hidden="true" />
            <strong>Chưa có nhân viên</strong>
            <p>Thêm nhân viên để họ đăng nhập vào trang staff.</p>
          </div>
        ) : (
          staff.map((staffMember) => (
            <StaffCard
              key={staffMember.uid}
              staff={staffMember}
              busy={busyId === staffMember.uid}
              onSave={saveStaff}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StaffCard({
  staff,
  busy,
  onSave,
}: {
  staff: StaffProfile;
  busy: boolean;
  onSave: (staff: StaffProfile, payload: Partial<StaffProfile>) => void;
}) {
  const [name, setName] = useState(staff.name);
  const [phone, setPhone] = useState(staff.phone);

  useEffect(() => {
    setName(staff.name);
    setPhone(staff.phone);
  }, [staff.name, staff.phone]);

  return (
    <article className="ops-card static-card management-card">
      <div className="management-card-header">
        <span className="ops-card-title">{staff.name || staff.uid}</span>
        <span className={staff.isActive ? "pill" : "pill muted-pill"}>
          {staff.isActive ? "Đang hoạt động" : "Đã tắt"}
        </span>
      </div>
      <small>UID: {staff.uid}</small>
      <div className="staff-edit-grid">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tên nhân viên" />
        <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="SĐT nội bộ" />
      </div>
      <div className="button-row wrap-row">
        <button className="secondary-button" disabled={busy} onClick={() => onSave(staff, { name, phone })}>
          <Save size={18} aria-hidden="true" />
          Lưu
        </button>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => onSave(staff, { isActive: !staff.isActive })}
        >
          <Power size={18} aria-hidden="true" />
          {staff.isActive ? "Tắt" : "Bật"}
        </button>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => onSave(staff, { canRedeemRewards: !staff.canRedeemRewards })}
        >
          <TicketCheck size={18} aria-hidden="true" />
          {staff.canRedeemRewards ? "Tắt đổi quà" : "Cho đổi quà"}
        </button>
      </div>
    </article>
  );
}

function CustomerSearchPanel({
  salonId,
  onMessage,
  onError,
}: {
  salonId: string;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CustomerLookupResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    onMessage("");
    onError("");

    try {
      setResults(await searchSalonCustomers({ salonId, term }));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không tìm được khách");
    } finally {
      setLoading(false);
    }
  }

  async function copyReward(code: string) {
    await navigator.clipboard.writeText(code);
    onMessage("Đã copy mã quà.");
  }

  return (
    <div className="panel">
      <div className="section-heading">
        <Search size={22} aria-hidden="true" />
        <div>
          <h2>Tìm khách</h2>
          <p className="muted">Tìm theo tên hoặc 4 số cuối SĐT để xem điểm, lịch sử và mã quà chưa dùng.</p>
        </div>
      </div>

      <div className="inline-form">
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              search();
            }
          }}
          placeholder="Ví dụ: Anh Tân hoặc 8761"
        />
        <button className="primary-button" disabled={loading || term.trim().length < 2} onClick={search}>
          <Search size={18} aria-hidden="true" />
          Tìm
        </button>
      </div>

      <div className="ops-list">
        {results.length === 0 ? (
          <div className="empty-state compact-empty">
            <Search size={28} aria-hidden="true" />
            <strong>{loading ? "Đang tìm khách" : "Chưa có kết quả"}</strong>
            <p>Nhập ít nhất 2 ký tự hoặc 4 số cuối SĐT để tìm nhanh.</p>
          </div>
        ) : (
          results.map((customer) => (
            <article className="ops-card static-card customer-result-card" key={customer.id}>
              <div className="management-card-header">
                <span className="ops-card-title">{customer.name}</span>
                <span className="pill">{customer.points} điểm</span>
              </div>
              <span>SĐT: {customer.phoneLast4 ? `******${customer.phoneLast4}` : "Chưa có"}</span>
              <span>Lần ghé gần nhất: {formatDateTime(customer.lastVisitAtMs) || "Chưa có"}</span>

              <div className="customer-insight-grid">
                <div>
                  <strong>Lịch sử gần đây</strong>
                  {customer.recentRecords.length === 0 ? (
                    <small>Chưa có lịch sử</small>
                  ) : (
                    customer.recentRecords.map((record) => (
                      <small key={record.id}>
                        {formatDateTime(record.createdAtMs)} · {record.staffName || "Nhân viên"} · {record.note || "Không ghi chú"}
                      </small>
                    ))
                  )}
                </div>
                <div>
                  <strong>Mã quà chưa dùng</strong>
                  {customer.unusedRewards.length === 0 ? (
                    <small>Không có mã quà</small>
                  ) : (
                    customer.unusedRewards.map((reward) => (
                      <button
                        className="reward-code-button"
                        key={reward.id}
                        type="button"
                        onClick={() => copyReward(reward.rewardCode)}
                      >
                        <Gift size={16} aria-hidden="true" />
                        {reward.rewardName}: {reward.rewardCode}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
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
