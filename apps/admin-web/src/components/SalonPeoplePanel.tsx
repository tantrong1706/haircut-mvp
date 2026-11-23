import { useEffect, useState } from "react";
import { adminApi, type AdminSalonPeople } from "../services/adminApi";
import { adminErrorMessage } from "../services/adminSupport";

const states = {
  active: "Đang hoạt động",
  inactive: "Tạm ngưng",
  missing: "Không tìm thấy tài khoản đăng nhập",
} as const;
const formatDate = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" });

export function SalonPeoplePanel({ salonId }: { salonId: string }) {
  const [pages, setPages] = useState<Array<string | undefined>>([undefined]);
  const [data, setData] = useState<AdminSalonPeople | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const cursor = pages[pages.length - 1];
  const loading = !data && !error;

  useEffect(() => {
    let cancelled = false;
    void adminApi
      .people(salonId, cursor)
      .then((result) => {
        if (result.salonId !== salonId) throw new Error("Unexpected salon response");
        if (!cancelled) setData(result);
      })
      .catch((caught) => {
        if (!cancelled) setError(adminErrorMessage(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [salonId, cursor, revision]);

  function changePage(next: Array<string | undefined>) {
    if (loading) return;
    setData(null);
    setError("");
    setPages(next);
  }

  return (
    <section className="salon-people-panel" aria-label="Chủ salon và danh sách khách">
      <h3>Chủ salon và khách</h3>
      <p className="muted">Chỉ xem dữ liệu salon đang chọn. Mỗi lần xem được ghi nhật ký.</p>
      {loading ? <p role="status">Đang tải hồ sơ salon…</p> : null}
      {error ? (
        <>
          <p className="notice error" role="alert">
            Chưa tải được hồ sơ salon. {error}
          </p>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setError("");
              setRevision((value) => value + 1);
            }}
          >
            Thử tải lại hồ sơ
          </button>
        </>
      ) : null}
      {data ? (
        <>
          <div className="salon-people-owner">
            <h4>Chủ salon</h4>
            {data.owner ? (
              <dl>
                <div>
                  <dt>Tên</dt>
                  <dd>{data.owner.name}</dd>
                </div>
                <div className="salon-people-email">
                  <dt>Email đăng nhập</dt>
                  <dd>{data.owner.email ?? "Chưa có email"}</dd>
                </div>
                <div>
                  <dt>Tài khoản</dt>
                  <dd>{states[data.owner.status]}</dd>
                </div>
                {data.owner.email ? (
                  <div>
                    <dt>Xác minh</dt>
                    <dd>
                      {data.owner.emailVerified ? "Email đã xác minh" : "Email chưa xác minh"}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="muted">Chưa tìm thấy thông tin chủ salon khớp hồ sơ.</p>
            )}
          </div>
          <div>
            <h4>Khách hàng</h4>
            {data.customers.length ? (
              <ul className="salon-people-list">
                {data.customers.map((row) => (
                  <li key={row.id}>
                    <strong>{row.name}</strong>
                    <dl>
                      <div>
                        <dt>Điện thoại</dt>
                        <dd>
                          {row.phoneLast4 && /^\d{4}$/u.test(row.phoneLast4)
                            ? `•••• ${row.phoneLast4}`
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Điểm</dt>
                        <dd>{row.points ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Lần ghé gần nhất</dt>
                        <dd>
                          {row.lastVisitAtMs === null ? "—" : formatDate.format(row.lastVisitAtMs)}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Không có khách ở trang này.</p>
            )}
          </div>
        </>
      ) : null}
      <nav className="button-row" aria-label="Phân trang khách hàng">
        <button
          type="button"
          className="secondary"
          disabled={loading || pages.length === 1}
          onClick={() => changePage(pages.slice(0, -1))}
        >
          Trang trước
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!data?.nextCursor || data.nextCursor === cursor}
          onClick={() => changePage([...pages, data?.nextCursor ?? undefined])}
        >
          Trang sau
        </button>
      </nav>
    </section>
  );
}
