import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Gift,
  Image as ImageIcon,
  Power,
  QrCode,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  TicketCheck,
  Trash2,
  UserPlus,
  UserRound,
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
  deleteCustomerData,
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
import { AppUser, updateOwnerAvatar } from "../services/auth";
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
  const [ownerAvatarUrl, setOwnerAvatarUrl] = useState(currentUser.avatarUrl || "");
  const [draftAvatarUrl, setDraftAvatarUrl] = useState(currentUser.avatarUrl || "");
  const [savingAvatar, setSavingAvatar] = useState(false);
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

  useEffect(() => {
    setOwnerAvatarUrl(currentUser.avatarUrl || "");
    setDraftAvatarUrl(currentUser.avatarUrl || "");
  }, [currentUser.avatarUrl, currentUser.uid]);

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

  async function saveOwnerAvatar(nextAvatarUrl = draftAvatarUrl) {
    setSavingAvatar(true);
    setMessage("");
    setError("");

    try {
      const result = await updateOwnerAvatar({
        salonId,
        avatarUrl: nextAvatarUrl,
      });
      setOwnerAvatarUrl(result.avatarUrl);
      setDraftAvatarUrl(result.avatarUrl);
      setMessage(result.avatarUrl ? "Đã cập nhật avatar chủ salon." : "Đã xóa avatar chủ salon.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được avatar");
    } finally {
      setSavingAvatar(false);
    }
  }

  return (
    <section className="ops-page owner-page">
      <header className="ops-topbar owner-topbar">
        <BrandLogo />
        <div>
          <p className="eyebrow">Chủ salon</p>
          <h1>Quản lý salon</h1>
          <span>{salonId}</span>
        </div>
        <OwnerAvatar avatarUrl={ownerAvatarUrl} name={currentUser.name} />
      </header>

      <div className="segmented-control owner-tabs compact-tabs" aria-label="Chọn mục quản lý">
        <OwnerTabButton
          active={activeTab === "overview"}
          icon={<BarChart3 size={18} />}
          label="Tổng"
          onClick={() => setActiveTab("overview")}
        />
        <OwnerTabButton
          active={activeTab === "approvals"}
          icon={<ClipboardCheck size={18} />}
          label="Duyệt"
          onClick={() => setActiveTab("approvals")}
        />
        <OwnerTabButton
          active={activeTab === "mirrors"}
          icon={<QrCode size={18} />}
          label="QR"
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
          label="Khách"
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
          label="Quà"
          onClick={() => setActiveTab("redeem")}
        />
      </div>

      {activeTab === "overview" ? (
        <>
          <OwnerProfilePanel
            currentUser={currentUser}
            avatarUrl={ownerAvatarUrl}
            draftAvatarUrl={draftAvatarUrl}
            saving={savingAvatar}
            onDraftChange={setDraftAvatarUrl}
            onSave={() => saveOwnerAvatar()}
            onClear={() => saveOwnerAvatar("")}
          />
          <OverviewPanel
            overview={overview}
            loading={loadingOverview}
            onRefresh={refreshOverview}
            onOpenTab={setActiveTab}
          />
        </>
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

function OwnerProfilePanel({
  currentUser,
  avatarUrl,
  draftAvatarUrl,
  saving,
  onDraftChange,
  onSave,
  onClear,
}: {
  currentUser: AppUser;
  avatarUrl: string;
  draftAvatarUrl: string;
  saving: boolean;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
}) {
  const trimmedDraft = draftAvatarUrl.trim();
  const hasChanges = trimmedDraft !== avatarUrl;

  return (
    <div className="panel owner-profile-panel">
      <OwnerAvatar avatarUrl={trimmedDraft || avatarUrl} name={currentUser.name} large />
      <div className="owner-profile-form">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">Hồ sơ</p>
            <h2>Avatar chủ salon</h2>
          </div>
          <span className="pill muted-pill">{currentUser.name || "Chủ salon"}</span>
        </div>

        <label className="field">
          <span>
            <ImageIcon size={18} aria-hidden="true" />
            Link ảnh đại diện
          </span>
          <input
            value={draftAvatarUrl}
            onChange={(event) => onDraftChange(event.target.value)}
            inputMode="url"
            placeholder="https://..."
          />
        </label>

        <div className="button-row wrap-row">
          <button className="primary-button" disabled={saving || !hasChanges} onClick={onSave}>
            <Save size={18} aria-hidden="true" />
            {saving ? "Đang lưu..." : "Lưu avatar"}
          </button>
          <button className="secondary-button" disabled={saving || (!avatarUrl && !trimmedDraft)} onClick={onClear}>
            <Trash2 size={18} aria-hidden="true" />
            Xóa avatar
          </button>
        </div>
      </div>
    </div>
  );
}

function OwnerAvatar({
  avatarUrl,
  name,
  large = false,
}: {
  avatarUrl: string;
  name: string;
  large?: boolean;
}) {
  return (
    <div className={large ? "owner-avatar large" : "owner-avatar"}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" />
      ) : (
        <>
          <UserRound size={large ? 30 : 22} aria-hidden="true" />
          <span>{ownerInitials(name)}</span>
        </>
      )}
    </div>
  );
}

function ownerInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (words.length === 0) {
    return "HC";
  }

  return words.map((word) => word[0]?.toUpperCase() || "").join("");
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
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Hôm nay</p>
          <h2>Tổng quan</h2>
        </div>
        <button className="icon-text-button" disabled={loading} onClick={onRefresh}>
          <RefreshCcw size={18} aria-hidden="true" />
          {loading ? "Đang tải" : "Làm mới"}
        </button>
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await createStaffProfile({ salonId, email, password, name, phone, canRedeemRewards });
      setEmail("");
      setPassword("");
      setName("");
      setPhone("");
      setCanRedeemRewards(false);
      await refresh();
      onMessage("Đã tạo tài khoản nhân viên.");
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
          <p className="muted">Tạo tài khoản nhân viên bằng email và mật khẩu tạm thời.</p>
        </div>
      </div>

      <div className="staff-create-grid">
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email nhân viên" />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          placeholder="Mật khẩu tạm thời"
        />
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
        <button
          className="primary-button"
          disabled={busyId === "new" || !email.trim() || password.length < 6 || !name.trim()}
          onClick={addStaff}
        >
          <UserPlus size={18} aria-hidden="true" />
          Tạo
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
      {staff.email ? <span>{staff.email}</span> : null}
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
  const [busyCustomerId, setBusyCustomerId] = useState("");

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

  async function deleteCustomer(customer: CustomerLookupResult) {
    const ok = window.confirm(
      `Xóa toàn bộ dữ liệu của ${customer.name}? Hành động này sẽ xóa hồ sơ, lịch sử, mã quà và ảnh đã lưu.`,
    );
    if (!ok) {
      return;
    }

    setBusyCustomerId(customer.id);
    onMessage("");
    onError("");

    try {
      const result = await deleteCustomerData({ salonId, customerId: customer.id });
      setResults((current) => current.filter((item) => item.id !== customer.id));
      onMessage(
        `Đã xóa dữ liệu khách: ${result.deletedRecords} lịch sử, ${result.deletedRewards} mã quà, ${result.deletedStorageFiles} ảnh.`,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không xóa được dữ liệu khách");
    } finally {
      setBusyCustomerId("");
    }
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

              <div className="button-row wrap-row">
                <button
                  className="secondary-button danger-button"
                  disabled={busyCustomerId === customer.id}
                  onClick={() => deleteCustomer(customer)}
                >
                  <Trash2 size={18} aria-hidden="true" />
                  {busyCustomerId === customer.id ? "Đang xóa..." : "Xóa dữ liệu khách"}
                </button>
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
