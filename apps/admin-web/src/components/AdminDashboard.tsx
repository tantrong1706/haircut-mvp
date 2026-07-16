import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { signOut, type User } from "firebase/auth";
import type { SalonStatus, SystemFeatures } from "@haircut/contracts";
import {
  Activity,
  Building2,
  CirclePause,
  Gauge,
  History,
  LoaderCircle,
  LogOut,
  RefreshCcw,
  Save,
  Settings2,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { auth } from "../services/firebase";
import {
  adminApi,
  type AdminAuditEvent,
  type AdminOverview,
  type AdminSalon,
} from "../services/adminApi";

type Tab = "overview" | "salons" | "features" | "operations" | "audit";
type DashboardData = Awaited<ReturnType<typeof loadDashboardData>>;

async function loadDashboardData() {
  const [overview, salonPage, featureResult, auditResult] = await Promise.all([
    adminApi.overview(),
    adminApi.salons(),
    adminApi.features(),
    adminApi.auditEvents(),
  ]);

  return {
    overview,
    salons: salonPage.salons,
    features: featureResult.features,
    auditEvents: auditResult.events,
  };
}

const tabs: Array<{ id: Tab; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "Tổng quan", icon: Gauge },
  { id: "salons", label: "Salon", icon: Building2 },
  { id: "features", label: "Tính năng", icon: Settings2 },
  { id: "operations", label: "Xử lý sự cố", icon: Wrench },
  { id: "audit", label: "Nhật ký", icon: History },
];

const featureLabels: Record<keyof Pick<SystemFeatures, "checkinEnabled" | "luckyWheelEnabled" | "rewardRedeemEnabled" | "photoUploadEnabled" | "pointApprovalEnabled" | "maintenanceMode">, string> = {
  checkinEnabled: "Khách check-in",
  luckyWheelEnabled: "Vòng quay",
  rewardRedeemEnabled: "Đổi mã quà",
  photoUploadEnabled: "Tải ảnh kiểu tóc",
  pointApprovalEnabled: "Gửi và duyệt điểm",
  maintenanceMode: "Chế độ bảo trì",
};

export function AdminDashboard({ user }: { user: User }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [salons, setSalons] = useState<AdminSalon[]>([]);
  const [features, setFeatures] = useState<SystemFeatures | null>(null);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedSalonId, setSelectedSalonId] = useState("");
  const [statusReason, setStatusReason] = useState("");

  const applyDashboardData = useCallback((data: DashboardData) => {
    setOverview(data.overview);
    setSalons(data.salons);
    setFeatures(data.features);
    setAuditEvents(data.auditEvents);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      applyDashboardData(await loadDashboardData());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [applyDashboardData]);

  useEffect(() => {
    let cancelled = false;

    void loadDashboardData()
      .then((data) => {
        if (!cancelled) applyDashboardData(data);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(errorMessage(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyDashboardData]);

  const selectedSalon = useMemo(
    () => salons.find((salon) => salon.id === selectedSalonId),
    [salons, selectedSalonId],
  );

  async function changeSalonStatus(status: SalonStatus) {
    if (!selectedSalon) return;
    if (status !== "active" && !statusReason.trim()) {
      setError("Nhập lý do trước khi khóa salon.");
      return;
    }
    await runAction(async () => {
      await adminApi.updateSalonStatus({ salonId: selectedSalon.id, status, reason: statusReason.trim() });
      setStatusReason("");
      setSelectedSalonId("");
      await refresh();
    }, status === "active" ? "Đã mở lại salon." : "Đã khóa salon.");
  }

  async function saveFeatures() {
    if (!features) return;
    await runAction(async () => {
      const result = await adminApi.updateFeatures({ features });
      setFeatures(result.features);
      await refresh();
    }, "Đã lưu công tắc hệ thống.");
  }

  async function runAction(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><span className="brand-symbol"><ShieldCheck /></span><div><strong>HAIRCUT</strong><small>Admin</small></div></div>
        <nav aria-label="Điều hướng quản trị">
          {tabs.map((item) => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><Icon />{item.label}</button>; })}
        </nav>
        <div className="sidebar-user"><small>Đang đăng nhập</small><strong>{user.email}</strong><button onClick={() => void signOut(auth)}><LogOut />Đăng xuất</button></div>
      </aside>

      <main className="workspace">
        <header className="workspace-header"><div><p className="eyebrow">Điều hành nền tảng</p><h1>{tabs.find((item) => item.id === tab)?.label}</h1></div><button className="icon-button" title="Làm mới" onClick={() => void refresh()} disabled={loading || busy}><RefreshCcw className={loading ? "spin" : ""} /></button></header>
        {error ? <p className="notice error" role="alert">{error}</p> : null}
        {message ? <p className="notice success" role="status">{message}</p> : null}
        {loading ? <div className="loading-band"><LoaderCircle className="spin" />Đang tải dữ liệu hệ thống...</div> : null}

        {!loading && tab === "overview" && overview ? <Overview overview={overview} /> : null}
        {!loading && tab === "salons" ? (
          <section className="content-section">
            <div className="section-heading"><div><p className="eyebrow">Tenant</p><h2>Danh sách salon</h2></div><span>{salons.length} salon trên trang này</span></div>
            <div className="table-wrap"><table><thead><tr><th>Salon</th><th>Trạng thái</th><th>Gói</th><th>Khách</th><th></th></tr></thead><tbody>{salons.map((salon) => <tr key={salon.id}><td><strong>{salon.name}</strong><small>{salon.id}</small></td><td><StatusBadge status={salon.status} /></td><td>{salon.plan}</td><td>{salon.customerCount}</td><td><button className="compact" onClick={() => setSelectedSalonId(salon.id)}>Quản lý</button></td></tr>)}</tbody></table></div>
            {selectedSalon ? <div className="action-drawer"><div><p className="eyebrow">Thay đổi trạng thái</p><h3>{selectedSalon.name}</h3></div><label><span>Lý do</span><textarea value={statusReason} onChange={(event) => setStatusReason(event.target.value)} placeholder="Bắt buộc khi khóa salon" /></label><div className="button-row"><button className="danger" disabled={busy || selectedSalon.status === "suspended"} onClick={() => void changeSalonStatus("suspended")}><CirclePause />Khóa salon</button><button className="primary" disabled={busy || selectedSalon.status === "active"} onClick={() => void changeSalonStatus("active")}><ShieldCheck />Mở lại</button><button className="secondary" onClick={() => setSelectedSalonId("")}>Đóng</button></div></div> : null}
          </section>
        ) : null}
        {!loading && tab === "features" && features ? <FeaturePanel features={features} setFeatures={setFeatures} busy={busy} save={() => void saveFeatures()} /> : null}
        {!loading && tab === "operations" ? <OperationsPanel busy={busy} runAction={runAction} /> : null}
        {!loading && tab === "audit" ? <AuditPanel events={auditEvents} /> : null}
      </main>
    </div>
  );
}

function Overview({ overview }: { overview: AdminOverview }) {
  const metrics = [
    ["Salon hoạt động", overview.salons.active, Building2],
    ["Salon đang khóa", overview.salons.suspended, CirclePause],
    ["Owner và staff", overview.users.owners + overview.users.staff, Users],
    ["Yêu cầu điểm chờ", overview.operations.pendingPointRequests, Activity],
    ["Lượt đang mở", overview.operations.openSessions, Gauge],
  ] as const;
  return <section className="metric-grid">{metrics.map(([label, value, Icon]) => <article key={label}><Icon /><span>{label}</span><strong>{value}</strong></article>)}</section>;
}

function FeaturePanel({ features, setFeatures, busy, save }: { features: SystemFeatures; setFeatures: (value: SystemFeatures) => void; busy: boolean; save: () => void }) {
  const booleanKeys = Object.keys(featureLabels) as Array<keyof typeof featureLabels>;
  return <section className="content-section"><div className="section-heading"><div><p className="eyebrow">Công tắc khẩn cấp</p><h2>Tính năng toàn hệ thống</h2></div><button className="primary" disabled={busy} onClick={save}><Save />Lưu</button></div><div className="toggle-list">{booleanKeys.map((key) => <label key={key}><span><strong>{featureLabels[key]}</strong><small>{key === "maintenanceMode" ? "Khi bật, các thao tác ghi quan trọng sẽ dừng." : "Có hiệu lực với mọi salon nếu không có cấu hình riêng."}</small></span><input type="checkbox" checked={features[key]} onChange={(event) => setFeatures({ ...features, [key]: event.target.checked })} /></label>)}</div><div className="version-grid"><label><span>Phiên bản tối thiểu</span><input value={features.minimumSupportedAppVersion} onChange={(event) => setFeatures({ ...features, minimumSupportedAppVersion: event.target.value })} placeholder="Ví dụ: 1.0.0" /></label><label><span>Phiên bản khuyến nghị</span><input value={features.recommendedAppVersion} onChange={(event) => setFeatures({ ...features, recommendedAppVersion: event.target.value })} placeholder="Ví dụ: 1.2.0" /></label></div></section>;
}

function OperationsPanel({ busy, runAction }: { busy: boolean; runAction: (action: () => Promise<void>, success: string) => Promise<void> }) {
  const [userId, setUserId] = useState(""); const [sessionId, setSessionId] = useState(""); const [reason, setReason] = useState("");
  async function submit(event: FormEvent, kind: "disable" | "enable" | "cancel") { event.preventDefault(); if (!reason.trim() && kind !== "enable") return; if (kind === "cancel") { await runAction(() => adminApi.cancelSession({ sessionId: sessionId.trim(), reason: reason.trim() }).then(() => undefined), "Đã hủy lượt treo."); } else { await runAction(() => adminApi.updateUserStatus({ uid: userId.trim(), isActive: kind === "enable", reason: reason.trim() }).then(() => undefined), kind === "enable" ? "Đã mở lại tài khoản." : "Đã khóa tài khoản và buộc đăng xuất."); } }
  return <section className="operation-grid"><form onSubmit={(event) => void submit(event, "disable")}><h2>Tài khoản owner/staff</h2><label><span>Firebase UID</span><input value={userId} onChange={(event) => setUserId(event.target.value)} required /></label><label><span>Lý do</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="button-row"><button className="danger" disabled={busy || !userId.trim() || !reason.trim()} type="submit">Khóa và đăng xuất</button><button className="secondary" disabled={busy || !userId.trim()} type="button" onClick={(event) => void submit(event as unknown as FormEvent, "enable")}>Mở lại</button></div></form><form onSubmit={(event) => void submit(event, "cancel")}><h2>Hủy lượt bị treo</h2><label><span>Session ID</span><input value={sessionId} onChange={(event) => setSessionId(event.target.value)} required /></label><label><span>Lý do</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label><button className="danger" disabled={busy || !sessionId.trim() || !reason.trim()} type="submit">Hủy lượt</button></form></section>;
}

function AuditPanel({ events }: { events: AdminAuditEvent[] }) { return <section className="content-section"><div className="section-heading"><div><p className="eyebrow">Truy vết</p><h2>Nhật ký gần nhất</h2></div></div><div className="audit-list">{events.length === 0 ? <p className="empty">Chưa có thao tác quản trị.</p> : events.map((event) => <article key={event.id}><span className="audit-dot" /><div><strong>{event.action}</strong><small>{event.targetType} · {event.targetId}</small></div><time>{formatDate(event.createdAtMs)}</time></article>)}</div></section>; }
function StatusBadge({ status }: { status: SalonStatus }) { const label = status === "active" ? "Hoạt động" : status === "suspended" ? "Đang khóa" : "Chờ xóa"; return <span className={`status ${status}`}>{label}</span>; }
function formatDate(value: number | null) { return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(value) : "Chưa rõ"; }
function errorMessage(value: unknown) { const candidate = value as { message?: unknown }; return typeof candidate?.message === "string" ? candidate.message.replace(/^Firebase:\s*/i, "") : "Thao tác chưa thành công. Vui lòng thử lại."; }
