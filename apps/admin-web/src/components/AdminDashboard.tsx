import { useEffect, useRef, useState } from "react";
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
  Wrench,
} from "lucide-react";
import { auth, firebaseProjectId } from "../services/firebase";
import { ADMIN_TABS, type AdminTab } from "../adminCapabilities";
import { adminErrorMessage, supportLinks } from "../services/adminSupport";
import { SalonSupportPanel } from "./SalonSupportPanel";
import {
  adminApi,
  type AdminAuditEvent,
  type AdminOverview,
  type AdminSalon,
} from "../services/adminApi";

const tabIcons: Record<AdminTab, typeof Gauge> = {
  overview: Gauge,
  salons: Building2,
  features: Settings2,
  audit: History,
  support: Wrench,
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
  const [salons, setSalons] = useState<AdminSalon[] | null>(null);
  const [features, setFeatures] = useState<SystemFeatures | null>(null);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<AdminTab, string>>>({});
  const [revision, setRevision] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<AdminSalon | null>(null);
  const alive = useRef(true);
  const pageGeneration = useRef(0);
  const paging = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const refresh = () => {
    pageGeneration.current++;
    paging.current = false;
    setLoadingMore(false);
    setErrors({});
    setLoading(true);
    setOverview(null);
    setSalons(null);
    setFeatures(null);
    setAuditEvents(null);
    setNextCursor(null);
    setRevision((value) => value + 1);
  };

  useEffect(() => {
    let cancelled = false;
    const failure = (section: AdminTab, prefix: string) => (caught: unknown) => {
      if (!cancelled)
        setErrors((previous) => ({
          ...previous,
          [section]: `${prefix}. ${adminErrorMessage(caught)}`,
        }));
    };
    void Promise.all([
      adminApi
        .overview()
        .then((result) => {
          if (!cancelled) setOverview(result);
        })
        .catch(failure("overview", "Chưa tải được tổng quan")),
      adminApi
        .salons()
        .then((result) => {
          if (!cancelled) {
            setSalons(result.salons);
            setNextCursor(result.nextCursor);
          }
        })
        .catch(failure("salons", "Chưa tải được danh sách salon")),
      adminApi
        .features()
        .then((result) => {
          if (!cancelled) setFeatures(result.features);
        })
        .catch(failure("features", "Chưa tải được cấu hình")),
      adminApi
        .auditEvents()
        .then((result) => {
          if (!cancelled) setAuditEvents(result.events);
        })
        .catch(failure("audit", "Chưa tải được nhật ký")),
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  async function loadMore() {
    if (!nextCursor || paging.current) return;
    const generation = pageGeneration.current;
    paging.current = true;
    setLoadingMore(true);
    try {
      const result = await adminApi.salons(nextCursor);
      if (!alive.current || generation !== pageGeneration.current) return;
      setSalons((previous) => [
        ...new Map(
          [...(previous || []), ...result.salons].map((salon) => [salon.id, salon]),
        ).values(),
      ]);
      setNextCursor(result.nextCursor === nextCursor ? null : result.nextCursor);
      setErrors((previous) => ({ ...previous, salons: undefined }));
    } catch (caught) {
      if (alive.current && generation === pageGeneration.current)
        setErrors((previous) => ({
          ...previous,
          salons: `Chưa tải được trang salon tiếp theo. ${adminErrorMessage(caught)}`,
        }));
    } finally {
      if (alive.current && generation === pageGeneration.current) {
        paging.current = false;
        setLoadingMore(false);
      }
    }
  }

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
          {ADMIN_TABS.map((item) => {
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
            <p className="eyebrow">Trung tâm quản trị salon</p>
            <h1>{ADMIN_TABS.find((item) => item.id === tab)?.label}</h1>
          </div>
          <button className="icon-button" title="Làm mới" onClick={refresh} disabled={loading}>
            <RefreshCcw className={loading ? "spin" : ""} />
          </button>
        </header>
        <p className="notice">
          Xem tất cả salon, kiểm tra từng salon và chỉ sửa đúng lỗi đã đối chiếu. Mọi thao tác sửa
          đều cần xác nhận và được ghi nhật ký.
        </p>
        {errors[tab] ? (
          <p className="notice error" role="alert">
            {errors[tab]}
          </p>
        ) : null}
        {loading ? (
          <div className="loading-band">
            <LoaderCircle className="spin" />
            Đang tải dữ liệu hệ thống...
          </div>
        ) : null}

        {tab === "overview" && overview ? <Overview overview={overview} /> : null}
        {tab === "salons" ? (
          <>
            {salons ? <SalonTable salons={salons} onSelect={setSelected} /> : null}
            {nextCursor ? (
              <button
                className="secondary load-more"
                disabled={loadingMore || loading}
                onClick={() => void loadMore()}
              >
                {loadingMore ? "Đang tải thêm…" : "Tải thêm salon"}
              </button>
            ) : null}
            {selected ? (
              <SalonSupportPanel
                key={selected.id}
                salon={selected}
                onClose={() => setSelected(null)}
                onRepaired={refresh}
              />
            ) : null}
          </>
        ) : null}
        {tab === "features" && features ? <FeaturePanel features={features} /> : null}
        {tab === "audit" && auditEvents ? <AuditPanel events={auditEvents} /> : null}
        {tab === "support" ? (
          <section className="content-section">
            <h2>Xử lý đúng loại sự cố</h2>
            <p>
              Kiểm tra salon ở mục Salon trước. Lỗi phần mềm cần bản vá đã kiểm thử; lỗi hạ tầng cần
              xử lý tại Google Cloud. Không có nút tự sửa mọi lỗi.
            </p>
            <div className="support-links">
              {supportLinks(firebaseProjectId).map((link) => (
                <article key={link.href}>
                  <h3>{link.label}</h3>
                  <p>{link.description}</p>
                  <a
                    className="text-button"
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Mở công cụ Google
                  </a>
                </article>
              ))}
            </div>
          </section>
        ) : null}
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

function SalonTable({
  salons,
  onSelect,
}: {
  salons: AdminSalon[];
  onSelect: (salon: AdminSalon) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = salons.filter(
    (salon) =>
      `${salon.name} ${salon.id}`
        .toLocaleLowerCase("vi")
        .includes(search.trim().toLocaleLowerCase("vi")) &&
      (status === "all" || salon.status === status),
  );
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Tenant</p>
          <h2>Danh sách salon</h2>
        </div>
        <span>Đã tải {salons.length} salon</span>
      </div>
      <div className="salon-filters">
        <label>
          Tìm trong salon đã tải
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tên hoặc mã salon"
          />
        </label>
        <label>
          Trạng thái
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="active">Hoạt động</option>
            <option value="suspended">Đang khóa</option>
            <option value="pending_deletion">Chờ xóa</option>
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table className="salon-table" role="table">
          <thead>
            <tr>
              <th>Salon</th>
              <th>Trạng thái</th>
              <th>Gói</th>
              <th>Khách</th>
              <th>Kiểm tra</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((salon) => (
              <tr key={salon.id}>
                <td data-label="Salon">
                  <strong>{salon.name}</strong>
                  <small>{salon.id}</small>
                </td>
                <td data-label="Trạng thái">
                  <StatusBadge status={salon.status} />
                </td>
                <td data-label="Gói">{salon.plan}</td>
                <td data-label="Khách">{salon.customerCount}</td>
                <td data-label="Kiểm tra">
                  <button
                    className="secondary compact"
                    aria-label={`Kiểm tra ${salon.name}`}
                    onClick={() => onSelect(salon)}
                  >
                    Kiểm tra
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="empty">
            {salons.length ? "Không có salon khớp bộ lọc trong dữ liệu đã tải." : "Chưa có salon"}
          </p>
        ) : null}
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
