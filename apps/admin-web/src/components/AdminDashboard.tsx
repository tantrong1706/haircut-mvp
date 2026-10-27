import { useEffect, useRef, useState } from "react";
import { signOut, type User } from "firebase/auth";
import type { SystemFeatures } from "@haircut/contracts";
import {
  Building2,
  Gauge,
  History,
  LoaderCircle,
  LogOut,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { auth, firebaseProjectId } from "../services/firebase";
import { ADMIN_TABS, type AdminTab } from "../adminCapabilities";
import { adminErrorMessage } from "../services/adminSupport";
import { SalonSupportPanel } from "./SalonSupportPanel";
import { AuditPanel, FeaturePanel, Overview, SupportSteps } from "./AdminSections";
import { SalonDirectory } from "./SalonDirectory";
import { SupportGuide } from "./SupportGuide";
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
    <div className="admin-shell" data-release={import.meta.env.VITE_APP_VERSION || "local"}>
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
                aria-current={tab === item.id ? "page" : undefined}
                onClick={() => setTab(item.id)}
              >
                <Icon aria-hidden="true" />
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
          <button className="secondary workspace-refresh" onClick={refresh} disabled={loading}>
            <RefreshCcw className={loading ? "spin" : ""} aria-hidden="true" />
            Làm mới dữ liệu
          </button>
        </header>
        <section className="data-status-strip" aria-label="Tình trạng dữ liệu">
          <span className="quiet-label">
            <ShieldCheck aria-hidden="true" /> Quyền quản trị đã xác minh
          </span>
          <div>
            {ADMIN_TABS.filter((item) => errors[item.id]).map((item) => (
              <button className="status-link" key={item.id} onClick={() => setTab(item.id)}>
                {item.label}{" "}
                {item.id === "salons" && salons !== null ? "chưa tải đủ" : "chưa tải được"}
              </button>
            ))}
          </div>
          <span className="quiet-label">
            {loading
              ? "Đang cập nhật dữ liệu…"
              : Object.values(errors).some(Boolean)
                ? "Có mục cần kiểm tra kết nối"
                : "Dữ liệu đã tải · Chưa quét toàn bộ salon"}
          </span>
        </section>
        {errors[tab] ? (
          <div className="notice error load-error" role="alert">
            <div>
              <strong>Chưa tải được mục này</strong>
              <p>{errors[tab]}</p>
            </div>
            <button className="secondary" disabled={loading} onClick={refresh}>
              Thử tải lại
            </button>
          </div>
        ) : null}
        {loading ? (
          <div className="loading-band">
            <LoaderCircle className="spin" />
            Đang tải dữ liệu hệ thống...
          </div>
        ) : null}

        {tab === "overview" && overview ? (
          <Overview overview={overview} onOpenSalons={() => setTab("salons")} />
        ) : null}
        {tab === "salons" ? (
          <>
            <SupportSteps />
            <div className={`salon-workspace${selected ? " has-selection" : ""}`}>
              <div className="directory-column">
                {salons ? (
                  <SalonDirectory
                    salons={salons}
                    selectedId={selected?.id}
                    onSelect={setSelected}
                  />
                ) : null}
                {nextCursor ? (
                  <button
                    className="secondary load-more"
                    disabled={loadingMore || loading}
                    onClick={() => void loadMore()}
                  >
                    {loadingMore ? "Đang tải thêm…" : "Tải thêm salon"}
                  </button>
                ) : null}
              </div>
              {selected ? (
                <SalonSupportPanel
                  key={selected.id}
                  salon={selected}
                  onClose={() => setSelected(null)}
                  onRepaired={refresh}
                />
              ) : (
                <section className="empty-workbench surface">
                  <Building2 aria-hidden="true" />
                  <h2>Chọn một salon để bắt đầu</h2>
                  <p>
                    Xem kết quả đối chiếu, hướng xử lý và phạm vi kiểm tra tại đây. Chọn salon không
                    tự sửa dữ liệu.
                  </p>
                  <span className="quiet-label">Không quét tất cả salon trong nền</span>
                </section>
              )}
            </div>
          </>
        ) : null}
        {tab === "features" && features ? <FeaturePanel features={features} /> : null}
        {tab === "audit" && auditEvents ? <AuditPanel events={auditEvents} /> : null}
        {tab === "support" ? (
          <SupportGuide projectId={firebaseProjectId} onOpenSalons={() => setTab("salons")} />
        ) : null}
      </main>
    </div>
  );
}
