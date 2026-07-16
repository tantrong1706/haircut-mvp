import { useCallback, useEffect, useState } from "react";
import { signOut, type User } from "firebase/auth";
import type { SystemFeatures } from "@haircut/contracts";
import {
  Activity,
  Building2,
  CirclePause,
  Gauge,
  History,
  LoaderCircle,
  LogOut,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { auth } from "../services/firebase";
import { READ_ONLY_ADMIN_TABS, type AdminTab } from "../adminCapabilities";
import {
  adminApi,
  type AdminAuditEvent,
  type AdminOverview,
  type AdminSalon,
} from "../services/adminApi";

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

const tabIcons: Record<AdminTab, typeof Gauge> = {
  overview: Gauge,
  salons: Building2,
  features: Settings2,
  audit: History,
};

const featureLabels: Record<
  keyof Pick<
    SystemFeatures,
    | "checkinEnabled"
    | "luckyWheelEnabled"
    | "rewardRedeemEnabled"
    | "photoUploadEnabled"
    | "pointApprovalEnabled"
    | "maintenanceMode"
  >,
  string
> = {
  checkinEnabled: "Khách check-in",
  luckyWheelEnabled: "Vòng quay",
  rewardRedeemEnabled: "Đổi mã quà",
  photoUploadEnabled: "Tải ảnh kiểu tóc",
  pointApprovalEnabled: "Gửi và duyệt điểm",
  maintenanceMode: "Chế độ bảo trì",
};

export function AdminDashboard({ user }: { user: User }) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [salons, setSalons] = useState<AdminSalon[]>([]);
  const [features, setFeatures] = useState<SystemFeatures | null>(null);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-symbol">
            <ShieldCheck />
          </span>
          <div>
            <strong>HAIRCUT</strong>
            <small>Admin</small>
          </div>
        </div>
        <nav aria-label="Điều hướng quản trị">
          {READ_ONLY_ADMIN_TABS.map((item) => {
            const Icon = tabIcons[item.id];
            return (
              <button
                key={item.id}
                className={tab === item.id ? "active" : ""}
                onClick={() => setTab(item.id)}
              >
                <Icon />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <small>Đang đăng nhập</small>
          <strong>{user.email}</strong>
          <button onClick={() => void signOut(auth)}>
            <LogOut />
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Theo dõi nền tảng</p>
            <h1>{READ_ONLY_ADMIN_TABS.find((item) => item.id === tab)?.label}</h1>
          </div>
          <button
            className="icon-button"
            title="Làm mới"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCcw className={loading ? "spin" : ""} />
          </button>
        </header>
        <p className="notice">
          Admin đang ở chế độ chỉ đọc. Mọi thay đổi production phải qua quy trình vận hành riêng.
        </p>
        {error ? (
          <p className="notice error" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? (
          <div className="loading-band">
            <LoaderCircle className="spin" />
            Đang tải dữ liệu hệ thống...
          </div>
        ) : null}

        {!loading && tab === "overview" && overview ? <Overview overview={overview} /> : null}
        {!loading && tab === "salons" ? <SalonTable salons={salons} /> : null}
        {!loading && tab === "features" && features ? <FeaturePanel features={features} /> : null}
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
  return (
    <section className="metric-grid">
      {metrics.map(([label, value, Icon]) => (
        <article key={label}>
          <Icon />
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

function SalonTable({ salons }: { salons: AdminSalon[] }) {
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Tenant</p>
          <h2>Danh sách salon</h2>
        </div>
        <span>{salons.length} salon trên trang này</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Salon</th>
              <th>Trạng thái</th>
              <th>Gói</th>
              <th>Khách</th>
            </tr>
          </thead>
          <tbody>
            {salons.map((salon) => (
              <tr key={salon.id}>
                <td>
                  <strong>{salon.name}</strong>
                  <small>{salon.id}</small>
                </td>
                <td>
                  <StatusBadge status={salon.status} />
                </td>
                <td>{salon.plan}</td>
                <td>{salon.customerCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FeaturePanel({ features }: { features: SystemFeatures }) {
  const booleanKeys = Object.keys(featureLabels) as Array<keyof typeof featureLabels>;
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Chỉ đọc</p>
          <h2>Cấu hình toàn hệ thống</h2>
        </div>
      </div>
      <div className="toggle-list">
        {booleanKeys.map((key) => (
          <div key={key}>
            <span>
              <strong>{featureLabels[key]}</strong>
              <small>{key}</small>
            </span>
            <StatusBadge status={features[key] ? "active" : "suspended"} />
          </div>
        ))}
      </div>
      <div className="version-grid">
        <div>
          <span>Phiên bản tối thiểu</span>
          <strong>{features.minimumSupportedAppVersion || "Chưa đặt"}</strong>
        </div>
        <div>
          <span>Phiên bản khuyến nghị</span>
          <strong>{features.recommendedAppVersion || "Chưa đặt"}</strong>
        </div>
      </div>
    </section>
  );
}

function AuditPanel({ events }: { events: AdminAuditEvent[] }) {
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Truy vết</p>
          <h2>Nhật ký gần nhất</h2>
        </div>
      </div>
      <div className="audit-list">
        {events.length === 0 ? (
          <p className="empty">Chưa có thao tác quản trị.</p>
        ) : (
          events.map((event) => (
            <article key={event.id}>
              <span className="audit-dot" />
              <div>
                <strong>{event.action}</strong>
                <small>
                  {event.targetType} · {event.targetId}
                </small>
              </div>
              <time>{formatDate(event.createdAtMs)}</time>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status === "active" ? "Hoạt động" : status === "suspended" ? "Đang tắt" : "Chờ xóa";
  return <span className={`status ${status}`}>{label}</span>;
}

function formatDate(value: number | null) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(value)
    : "Chưa rõ";
}

function errorMessage(value: unknown) {
  const candidate = value as { message?: unknown };
  return typeof candidate?.message === "string"
    ? candidate.message.replace(/^Firebase:\s*/i, "")
    : "Chưa tải được dữ liệu. Vui lòng thử lại.";
}
