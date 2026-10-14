import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCcw, Wrench, X } from "lucide-react";
import {
  adminApi,
  type AdminDiagnostics,
  type AdminSalon,
  type RepairAction,
} from "../services/adminApi";
import { adminErrorMessage, makeRepairInput } from "../services/adminSupport";

type Draft = {
  action: RepairAction;
  operationId: string;
  pointer?: AdminDiagnostics["stalePointers"][number];
};

export function SalonSupportPanel({
  salon,
  onClose,
  onRepaired,
}: {
  salon: AdminSalon;
  onClose: () => void;
  onRepaired: () => void;
}) {
  const [diagnostics, setDiagnostics] = useState<AdminDiagnostics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void adminApi
      .diagnostics(salon.id)
      .then((result) => {
        if (!cancelled) {
          setDiagnostics(result);
          setError("");
        }
      })
      .catch((caught) => {
        if (!cancelled) setError(adminErrorMessage(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salon.id, revision]);
  const refresh = () => {
    setLoading(true);
    setError("");
    setDiagnostics(null);
    setDraft(null);
    setRevision((value) => value + 1);
  };
  const start = (action: RepairAction, pointer?: Draft["pointer"]) => {
    setMessage("");
    setDraft({ action, pointer, operationId: crypto.randomUUID() });
  };
  return (
    <section className="support-panel" aria-labelledby="support-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Kiểm tra và hỗ trợ</p>
          <h2 id="support-title">Kiểm tra {salon.name}</h2>
          <small className="muted">{salon.id}</small>
        </div>
        <div className="button-row">
          <button className="secondary" disabled={loading || saving} onClick={refresh}>
            <RefreshCcw aria-hidden="true" />
            Kiểm tra lại
          </button>
          <button
            className="icon-button"
            aria-label="Đóng kiểm tra"
            disabled={saving}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </div>
      {loading ? (
        <p className="loading-band" role="status">
          <LoaderCircle className="spin" aria-hidden="true" />
          Đang đối chiếu dữ liệu…
        </p>
      ) : null}
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
      {diagnostics && !loading ? (
        <>
          <p className="muted">
            Kiểm tra lúc {new Date(diagnostics.checkedAtMs).toLocaleString("vi-VN")}. Kết quả phản
            ánh các quy tắc bên dưới, không thay thế nhật ký hạ tầng.
          </p>
          <div className="support-facts">
            <div>
              <span>Hồ sơ khách thực tế</span>
              <strong>{diagnostics.customerCount.actual}</strong>
            </div>
            <div>
              <span>Bộ đếm đang lưu</span>
              <strong>{diagnostics.customerCount.stored ?? "Không hợp lệ"}</strong>
            </div>
            <div>
              <span>Chi nhánh hoạt động</span>
              <strong>{diagnostics.activeBranches}</strong>
            </div>
          </div>
          {!diagnostics.repairsEnabled ? (
            <p className="notice">Máy chủ chưa bật chức năng sửa hỗ trợ. Các nút sửa đang khóa.</p>
          ) : null}
          {diagnostics.issues.length === 0 ? (
            <p className="notice success">
              <CheckCircle2 aria-hidden="true" />
              Không phát hiện bất thường trong phạm vi vừa kiểm tra.
            </p>
          ) : (
            <ul className="issue-list">
              {diagnostics.issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>
                  <AlertTriangle aria-hidden="true" />
                  <div>
                    <strong>{issue.message}</strong>
                    <small>{issue.code}</small>
                    {issue.action === "reconcile_customer_count" ? (
                      <button
                        className="secondary"
                        disabled={
                          !diagnostics.repairsEnabled ||
                          diagnostics.status === "pending_deletion" ||
                          saving
                        }
                        onClick={() => start("reconcile_customer_count")}
                      >
                        <Wrench aria-hidden="true" />
                        Đồng bộ bộ đếm khách
                      </button>
                    ) : null}
                    {!issue.action ? (
                      <p className="muted">
                        Cần kiểm tra cấu hình hoặc quyền tương ứng; không tự động sửa mục này.
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {diagnostics.stalePointers.length ? (
            <div className="pointer-list">
              <h3>Liên kết lượt có thể gỡ an toàn</h3>
              <p>
                Chỉ gỡ liên kết tới lượt đã kết thúc/không tồn tại. Không xóa lịch sử, cộng điểm
                hoặc bỏ thời gian chống lặp.
              </p>
              {diagnostics.stalePointers.map((pointer) => (
                <div key={pointer.pointerId}>
                  <code>Lượt {pointer.sessionId}</code>
                  <button
                    className="secondary"
                    disabled={
                      !diagnostics.repairsEnabled ||
                      diagnostics.status === "pending_deletion" ||
                      saving
                    }
                    onClick={() => start("clear_stale_session_pointer", pointer)}
                  >
                    Gỡ liên kết lượt {pointer.sessionId}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <p className="muted">
            Đã kiểm tra {diagnostics.pointerScan.checked} liên kết lượt.
            {diagnostics.pointerScan.hasMore
              ? " Chỉ kiểm tra 50 liên kết đầu; chưa thể kết luận cho các liên kết còn lại. Cần kiểm tra chuyên sâu."
              : ""}
          </p>
          {draft ? (
            <RepairForm
              key={draft.operationId}
              diagnostics={diagnostics}
              draft={draft}
              onCancel={() => setDraft(null)}
              onBusy={setSaving}
              onApplied={() => {
                if (!alive.current) return;
                setMessage("Đã xử lý và ghi nhật ký. Đang đối chiếu lại kết quả.");
                refresh();
                onRepaired();
              }}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function RepairForm({
  diagnostics,
  draft,
  onCancel,
  onBusy,
  onApplied,
}: {
  diagnostics: AdminDiagnostics;
  draft: Draft;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
  onApplied: () => void;
}) {
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const valid =
    name.trim() === diagnostics.salonName.trim() &&
    reason.trim().length >= 10 &&
    reason.trim().length <= 300 &&
    acknowledged &&
    diagnostics.repairsEnabled;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      await adminApi.repair(
        makeRepairInput(diagnostics, draft.action, reason, name, draft.operationId, draft.pointer),
      );
      if (alive.current) onApplied();
    } catch (caught) {
      if (alive.current) setError(adminErrorMessage(caught));
    } finally {
      inFlight.current = false;
      if (alive.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  return (
    <form className="repair-form" onSubmit={submit} aria-label="Xác nhận sửa dữ liệu">
      <h3>Xác nhận cho {diagnostics.salonName}</h3>
      <p>
        {draft.action === "reconcile_customer_count"
          ? `Chỉ sửa bộ đếm khách từ ${diagnostics.customerCount.stored ?? "không hợp lệ"} thành ${diagnostics.customerCount.actual}. Không thay đổi điểm của khách.`
          : `Chỉ gỡ liên kết của lượt ${draft.pointer?.sessionId}. Lịch sử và điểm được giữ nguyên.`}
      </p>
      <label>
        Nhập tên salon để xác nhận
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={busy}
          autoComplete="off"
          maxLength={200}
        />
      </label>
      <label>
        Lý do sửa
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={busy}
          minLength={10}
          maxLength={300}
        />
      </label>
      <label className="acknowledgement">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          disabled={busy}
        />
        Tôi đã kiểm tra đúng salon và hiểu phạm vi thay đổi.
      </label>
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="button-row">
        <button className="primary" disabled={!valid || busy} type="submit">
          {busy ? "Đang xử lý…" : "Xác nhận sửa"}
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={onCancel}>
          Hủy, không thay đổi
        </button>
      </div>
    </form>
  );
}
