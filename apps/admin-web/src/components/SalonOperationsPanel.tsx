import { useEffect, useRef, useState, type FormEvent } from "react";
import { CirclePause, ClipboardList, RefreshCcw } from "lucide-react";
import {
  adminApi,
  type AdminManagementAction,
  type AdminManagementInput,
  type AdminSalonOperations,
} from "../services/adminApi";
import { adminErrorMessage } from "../services/adminSupport";

const labels: Record<AdminManagementAction, string> = {
  suspend_salon: "Khóa salon",
  reactivate_salon: "Mở lại salon",
  cancel_point_request: "Hủy yêu cầu tích điểm",
};
const states = {
  waiting: "Đang chờ xác nhận",
  expired: "Đã hết hạn chờ",
  inconsistent: "Cần đối chiếu dữ liệu",
  unknown: "Chưa rõ hạn chờ",
};
type Draft = { action: AdminManagementAction; requestId?: string; operationId: string };
const formatDate = (value: number | null) =>
  value === null ? "Chưa rõ" : new Date(value).toLocaleString("vi-VN");

export function SalonOperationsPanel({
  salonId,
  onChanged,
}: {
  salonId: string;
  onChanged: () => void;
}) {
  const [data, setData] = useState<AdminSalonOperations | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const generation = useRef(0),
    pageBusy = useRef(false),
    writeBusy = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    generation.current++;
    pageBusy.current = false;
    setPaging(false);
    setData(null);
    setDraft(null);
    setError("");
    setLoading(true);
    void adminApi
      .salonOperations(salonId)
      .then((result) => {
        if (result.salonId !== salonId) throw new Error("Unexpected salon response");
        if (!cancelled) setData(result);
      })
      .catch((caught) => {
        if (!cancelled) setError(`Chưa tải được yêu cầu. ${adminErrorMessage(caught)}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      generation.current++;
    };
  }, [salonId, revision]);
  async function loadMore() {
    if (!data?.nextCursor || pageBusy.current || writeBusy.current) return;
    const current = generation.current,
      cursor = data.nextCursor;
    pageBusy.current = true;
    setPaging(true);
    try {
      const result = await adminApi.salonOperations(salonId, cursor);
      if (result.salonId !== salonId) throw new Error("Unexpected salon response");
      if (!alive.current || current !== generation.current) return;
      setData((previous) =>
        previous
          ? {
              ...result,
              requests: [
                ...new Map(
                  [...previous.requests, ...result.requests].map((row) => [row.id, row]),
                ).values(),
              ],
              nextCursor: result.nextCursor === cursor ? null : result.nextCursor,
            }
          : previous,
      );
      setError("");
    } catch (caught) {
      if (alive.current && current === generation.current)
        setError(`Chưa tải được trang tiếp theo. ${adminErrorMessage(caught)}`);
    } finally {
      if (alive.current && current === generation.current) {
        pageBusy.current = false;
        setPaging(false);
      }
    }
  }
  const start = (action: AdminManagementAction, requestId?: string) => {
    setError("");
    setMessage("");
    setDraft({ action, requestId, operationId: crypto.randomUUID() });
  };
  async function apply(input: AdminManagementInput) {
    if (writeBusy.current) return;
    writeBusy.current = true;
    setSaving(true);
    setError("");
    const current = generation.current;
    try {
      const result = await adminApi.manageSalon(input);
      if (!alive.current || generation.current !== current) return;
      setMessage(
        result.changed
          ? "Đã thực hiện và ghi nhật ký. Đang tải lại dữ liệu."
          : "Không có thay đổi cần ghi. Đang tải lại dữ liệu.",
      );
      setRevision((value) => value + 1);
      onChanged();
    } catch (caught) {
      if (alive.current && generation.current === current) setError(adminErrorMessage(caught));
    } finally {
      writeBusy.current = false;
      if (alive.current) setSaving(false);
    }
  }
  return (
    <section className="salon-operations" aria-label="Giám sát và thao tác salon">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Đối chiếu trước khi xử lý</p>
          <h3>
            <ClipboardList aria-hidden="true" /> Yêu cầu chờ & trạng thái salon
          </h3>
        </div>
        <button
          className="secondary"
          disabled={loading || saving || paging}
          onClick={() => setRevision((value) => value + 1)}
        >
          <RefreshCcw aria-hidden="true" /> Tải lại yêu cầu
        </button>
      </div>
      {loading ? <p role="status">Đang tải yêu cầu của salon…</p> : null}
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      {data ? (
        <>
          <p className="muted">
            Đối chiếu lúc {formatDate(data.checkedAtMs)}. Yêu cầu hết hạn không được tự cộng điểm
            hay tự khôi phục.
          </p>
          {!data.writesEnabled ? (
            <p className="notice">
              Thao tác khóa/mở và hủy yêu cầu chưa được máy chủ bật. Dữ liệu vẫn xem được.
            </p>
          ) : null}
          {data.status !== "pending_deletion" ? (
            <button
              className="secondary"
              disabled={!data.writesEnabled || saving || paging}
              onClick={() => start(data.status === "active" ? "suspend_salon" : "reactivate_salon")}
            >
              <CirclePause aria-hidden="true" />
              {data.status === "active" ? "Khóa salon" : "Mở lại salon"}
            </button>
          ) : (
            <p className="notice warning">
              Salon đang chờ xóa; không mở lại hoặc xử lý yêu cầu tại đây.
            </p>
          )}
          {draft ? (
            <ManagementConfirmation
              key={draft.operationId}
              data={data}
              draft={draft}
              saving={saving}
              onCancel={() => setDraft(null)}
              onApply={(input) => void apply(input)}
            />
          ) : null}
          <p className="directory-scope">
            Đã tải {data.requests.length} trong {data.totalPending} yêu cầu mang trạng thái chờ. Số
            hết hạn/lỗi chỉ phản ánh các dòng đã tải; không phải số lỗi toàn hệ thống.
          </p>
          {data.requests.length ? (
            <ul className="operation-list">
              {data.requests.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{row.branchName}</strong>
                    <code>{row.id}</code>
                    <span
                      className={`state-pill ${row.state === "waiting" ? "neutral" : "warning"}`}
                    >
                      {states[row.state]}
                    </span>
                    <small>
                      Tạo: {formatDate(row.createdAtMs)} · Hạn chờ: {formatDate(row.expiresAtMs)}
                    </small>
                  </div>
                  <button
                    className="secondary"
                    aria-label={`Hủy yêu cầu ${row.id}`}
                    disabled={!data.writesEnabled || !row.cancellable || saving || paging}
                    onClick={() => start("cancel_point_request", row.id)}
                  >
                    Hủy yêu cầu
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Không có yêu cầu đang chờ.</p>
          )}
          {data.nextCursor ? (
            <button
              className="secondary"
              disabled={paging || saving}
              onClick={() => void loadMore()}
            >
              {paging ? "Đang tải thêm…" : "Tải thêm yêu cầu"}
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function ManagementConfirmation({
  data,
  draft,
  saving,
  onCancel,
  onApply,
}: {
  data: AdminSalonOperations;
  draft: Draft;
  saving: boolean;
  onCancel: () => void;
  onApply: (input: AdminManagementInput) => void;
}) {
  const [name, setName] = useState(""),
    [reason, setReason] = useState(""),
    [acknowledged, setAcknowledged] = useState(false);
  const valid =
    name.trim() === data.salonName.trim() &&
    reason.trim().length >= 10 &&
    reason.trim().length <= 300 &&
    acknowledged &&
    data.writesEnabled;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || saving) return;
    onApply({
      ...draft,
      salonId: data.salonId,
      expectedStatus: data.status,
      confirmedSalonName: name.trim(),
      reason: reason.trim(),
    });
  }
  return (
    <section className="management-preview" aria-label="Xem trước thao tác quản trị">
      <h4>
        {labels[draft.action]} · {data.salonName}
      </h4>
      <p>
        {draft.action === "cancel_point_request"
          ? `Chỉ hủy yêu cầu ${draft.requestId} và đóng lượt chờ tương ứng. Không trừ/cộng điểm, không xóa ảnh hoặc hồ sơ khách.`
          : draft.action === "suspend_salon"
            ? "Tạm chặn các thao tác nghiệp vụ của salon; giữ nguyên tài khoản, ảnh, điểm và lịch sử. Có thể mở lại sau."
            : "Cho phép salon hoạt động lại. Không khôi phục yêu cầu đã hủy hoặc tự cấp quyền tài khoản."}
      </p>
      <form onSubmit={submit}>
        <label>
          Tên salon xác nhận thao tác
          <input
            value={name}
            maxLength={200}
            onChange={(event) => setName(event.target.value)}
            disabled={saving}
            autoComplete="off"
          />
        </label>
        <label>
          Lý do thao tác
          <textarea
            value={reason}
            minLength={10}
            maxLength={300}
            onChange={(event) => setReason(event.target.value)}
            disabled={saving}
          />
        </label>
        <label className="confirmation-check">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            disabled={saving}
          />
          Tôi hiểu phạm vi thao tác và đã đối chiếu đúng salon.
        </label>
        <div className="button-row">
          <button className="secondary" type="button" onClick={onCancel} disabled={saving}>
            Đóng, không thực hiện
          </button>
          <button className="primary" type="submit" disabled={!valid || saving}>
            {saving ? "Đang thực hiện…" : "Xác nhận thao tác"}
          </button>
        </div>
      </form>
    </section>
  );
}
