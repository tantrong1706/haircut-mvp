import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  LoaderCircle,
  RefreshCcw,
  Wrench,
  X,
} from "lucide-react";
import {
  adminApi,
  type AdminDiagnostics,
  type AdminSalon,
  type RepairAction,
} from "../services/adminApi";
import { adminErrorMessage, makeRepairInput } from "../services/adminSupport";
import {
  diagnosticSummary,
  formatDiagnosticReport,
  issueGuidance,
} from "../services/adminPresentation";

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
  const [copyMessage, setCopyMessage] = useState("");
  const [showCopyFallback, setShowCopyFallback] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    titleRef.current?.focus();
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
    setCopyMessage("");
    setShowCopyFallback(false);
    setRevision((value) => value + 1);
  };
  const start = (action: RepairAction, pointer?: Draft["pointer"]) => {
    setMessage("");
    setDraft({ action, pointer, operationId: crypto.randomUUID() });
  };
  async function copyReport() {
    if (!diagnostics || loading || saving) return;
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(formatDiagnosticReport(diagnostics));
      if (alive.current) {
        setCopyMessage("Đã sao chép kết quả, không kèm thông tin khách.");
        setShowCopyFallback(false);
      }
    } catch {
      if (alive.current) {
        setCopyMessage(
          "Thiết bị chưa cho phép sao chép. Bạn có thể chọn nội dung báo cáo bên dưới.",
        );
        setShowCopyFallback(true);
      }
    }
  }
  const summary = diagnostics ? diagnosticSummary(diagnostics) : null;
  return (
    <section className="support-panel" aria-labelledby="support-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Salon đang kiểm tra</p>
          <h2 id="support-title" ref={titleRef} tabIndex={-1}>
            Kiểm tra {salon.name}
          </h2>
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
            <span>Đổi salon</span>
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
          <div className={`diagnostic-summary ${summary?.tone}`}>
            {summary?.tone === "success" ? (
              <CheckCircle2 aria-hidden="true" />
            ) : (
              <AlertTriangle aria-hidden="true" />
            )}
            <div>
              <p className="eyebrow">Kết quả đối chiếu</p>
              <h3>{summary?.title}</h3>
              <p>
                {diagnostics.issues.length === 0 && diagnostics.stalePointers.length === 0
                  ? "Không phát hiện bất thường trong phạm vi vừa kiểm tra."
                  : "Đọc từng mục bên dưới. Chỉ thao tác sửa được máy chủ cho phép mới có nút xem trước."}
              </p>
            </div>
          </div>
          <p className="muted">
            Kiểm tra lúc {new Date(diagnostics.checkedAtMs).toLocaleString("vi-VN")}. Kết quả phản
            ánh các quy tắc bên dưới, không thay thế nhật ký hạ tầng.
          </p>
          <div className="diagnostic-tools">
            <button className="secondary" disabled={saving} onClick={() => void copyReport()}>
              <Copy aria-hidden="true" />
              Sao chép kết quả
            </button>
            <span className="quiet-label">Không kèm tên khách, ảnh, token hoặc mã quà</span>
          </div>
          {copyMessage ? (
            <p role="status" className="copy-feedback">
              {copyMessage}
            </p>
          ) : null}
          {showCopyFallback ? (
            <label className="copy-fallback">
              Báo cáo kiểm tra
              <textarea readOnly value={formatDiagnosticReport(diagnostics)} />
            </label>
          ) : null}
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
          {diagnostics.status === "pending_deletion" ? (
            <p className="notice warning">
              Salon đang chờ xóa; các thao tác sửa dữ liệu được khóa.
            </p>
          ) : null}
          {draft ? (
            <RepairForm
              key={draft.operationId}
              diagnostics={diagnostics}
              draft={draft}
              onCancel={() => setDraft(null)}
              onBusy={setSaving}
              onApplied={(changed) => {
                if (!alive.current) return;
                setMessage(
                  changed
                    ? "Đã xử lý và ghi nhật ký. Đang đối chiếu lại kết quả."
                    : "Máy chủ không ghi thêm thay đổi. Đang đối chiếu lại kết quả.",
                );
                refresh();
                onRepaired();
              }}
            />
          ) : null}
          {diagnostics.issues.length ? (
            <ul className="issue-list">
              {diagnostics.issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`} className={issue.severity}>
                  <AlertTriangle aria-hidden="true" />
                  <div>
                    <span
                      className={`state-pill ${issue.severity === "error" ? "error" : "warning"}`}
                    >
                      {issue.severity === "error" ? "Cần kiểm tra riêng" : "Cần đối chiếu"}
                    </span>
                    <h4>{issueGuidance(issue.code).title}</h4>
                    <p>{issue.message}</p>
                    <p className="issue-next-step">
                      <strong>Hướng xử lý</strong>
                      {issueGuidance(issue.code).nextStep}
                    </p>
                    <details>
                      <summary>Mã kiểm tra</summary>
                      <code>{issue.code}</code>
                    </details>
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
                      <span className="quiet-label">Không tự động sửa mục này</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
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
          <details className="support-technical">
            <summary>Thông tin kỹ thuật của salon</summary>
            <dl>
              <div>
                <dt>Mã salon</dt>
                <dd>
                  <code>{salon.id}</code>
                </dd>
              </div>
              <div>
                <dt>Mã chủ salon</dt>
                <dd>
                  <code>{salon.ownerId || "Chưa có"}</code>
                </dd>
              </div>
              <div>
                <dt>Gói đang ghi nhận</dt>
                <dd>{salon.plan || "Chưa rõ"}</dd>
              </div>
            </dl>
          </details>
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
  onApplied: (changed: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const alive = useRef(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    alive.current = true;
    headingRef.current?.focus();
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
      const result = await adminApi.repair(
        makeRepairInput(diagnostics, draft.action, reason, name, draft.operationId, draft.pointer),
      );
      if (alive.current) onApplied(result.changed);
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
      <div>
        <p className="eyebrow">Xem trước · chưa có dữ liệu bị sửa</p>
        <h3 ref={headingRef} tabIndex={-1}>
          Xác nhận cho {diagnostics.salonName}
        </h3>
      </div>
      <section className="repair-preview" aria-label="Xem trước thay đổi">
        {draft.action === "reconcile_customer_count" ? (
          <div className="preview-values">
            <div>
              <span>Đang lưu</span>
              <strong>{diagnostics.customerCount.stored ?? "Không hợp lệ"}</strong>
            </div>
            <ArrowRight aria-hidden="true" />
            <div>
              <span>Sau đồng bộ</span>
              <strong>{diagnostics.customerCount.actual}</strong>
            </div>
          </div>
        ) : (
          <div>
            <span>Liên kết được chọn</span>
            <code>{draft.pointer?.sessionId}</code>
          </div>
        )}
        <p>Phạm vi: chỉ salon này. Không sửa điểm, mã quà hoặc lịch sử cắt tóc.</p>
      </section>
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
