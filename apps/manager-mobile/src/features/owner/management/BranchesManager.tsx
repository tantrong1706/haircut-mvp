import {
  Copy,
  Download,
  MapPin,
  Plus,
  Power,
  Printer,
  QrCode,
  RefreshCcw,
  Save,
  Share2,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { type ConfirmDialogRequest } from "../../../components/ConfirmDialog";
import { EmptyState, InlineFeedback, LoadingState } from "../../../components/Feedback";
import {
  ActionRow,
  DetailHeader,
  Section,
} from "../../../components/ScreenPrimitives";
import {
  createBranch,
  getBranchQrSettings,
  migrateSalonBranches,
  rotateBranchQr,
  rotateSalonQr,
  updateBranch,
  type SalonBranch,
} from "../../../services/managerApi";
import { escapeHtml, safeFileName } from "../ownerFormatters";

type DetailTarget = { kind: "salon"; title: string; qrUrl: string } | { kind: "branch"; branch: SalonBranch };

export function BranchesManager({
  salonId,
  onConfirm,
  onBranchesChange,
}: {
  salonId: string;
  onConfirm: (request: ConfirmDialogRequest) => void;
  onBranchesChange: (branches: SalonBranch[]) => void;
}) {
  const [branches, setBranches] = useState<SalonBranch[]>([]);
  const [salonQrUrl, setSalonQrUrl] = useState("");
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void refresh();
  }, [salonId]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const result = await getBranchQrSettings(salonId);
      setBranches(result.branches);
      setSalonQrUrl(result.salonQrUrl);
      onBranchesChange(result.branches);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được chi nhánh.");
    } finally {
      setLoading(false);
    }
  }

  function commitBranches(next: SalonBranch[]) {
    const sorted = [...next].sort((a, b) => a.name.localeCompare(b.name, "vi"));
    setBranches(sorted);
    onBranchesChange(sorted);
  }

  async function addBranch() {
    setBusy("new");
    setError("");
    setMessage("");
    try {
      const created = await createBranch({ salonId, name, address, phone });
      commitBranches([...branches, created]);
      setName("");
      setAddress("");
      setPhone("");
      setCreating(false);
      setMessage("Đã tạo chi nhánh và QR riêng.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tạo được chi nhánh.");
    } finally {
      setBusy("");
    }
  }

  async function migrate() {
    setBusy("migration");
    setMessage("");
    setError("");
    try {
      await migrateSalonBranches(salonId);
      await refresh();
      setMessage("Đã chuyển dữ liệu Gương 1 cũ vào Chi nhánh chính.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không chuyển được dữ liệu cũ.");
    } finally {
      setBusy("");
    }
  }

  if (detail) {
    return (
      <QrDetail
        target={detail}
        salonId={salonId}
        busy={busy}
        onBack={() => setDetail(null)}
        onBusy={setBusy}
        onMessage={setMessage}
        onError={setError}
        onConfirm={onConfirm}
        onSalonQrChange={(qrUrl) => {
          setSalonQrUrl(qrUrl);
          setDetail({ kind: "salon", title: "QR chung của salon", qrUrl });
        }}
        onBranchChange={(branch) => {
          commitBranches(branches.map((item) => (item.id === branch.id ? branch : item)));
          setDetail({ kind: "branch", branch });
        }}
      />
    );
  }

  return (
    <div className="manager-subscreen">
      <div className="manager-section-heading">
        <div>
          <h2>Chi nhánh và QR</h2>
          <p>Một QR chung cho salon và một QR riêng cho mỗi chi nhánh.</p>
        </div>
        <button
          className="manager-button primary compact"
          type="button"
          onClick={() => setCreating((value) => !value)}
        >
          <Plus aria-hidden="true" />
          Thêm
        </button>
      </div>

      {creating ? (
        <Section title="Tạo chi nhánh">
          <label className="manager-field">
            <span>Tên chi nhánh</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="manager-field">
            <span>Địa chỉ</span>
            <input value={address} onChange={(event) => setAddress(event.target.value)} />
          </label>
          <label className="manager-field">
            <span>Số điện thoại</span>
            <input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <div className="manager-button-row">
            <button
              className="manager-button secondary"
              type="button"
              disabled={busy === "new"}
              onClick={() => setCreating(false)}
            >
              Hủy
            </button>
            <button
              className="manager-button primary"
              type="button"
              disabled={busy === "new" || !name.trim()}
              onClick={() => void addBranch()}
            >
              <Save aria-hidden="true" />
              {busy === "new" ? "Đang tạo..." : "Tạo chi nhánh"}
            </button>
          </div>
        </Section>
      ) : null}

      {loading ? (
        <LoadingState label="Đang tải chi nhánh" />
      ) : (
        <div className="manager-action-list">
          {salonQrUrl ? (
            <ActionRow
              icon={QrCode}
              title="QR chung của salon"
              description="Khách quét để chọn chi nhánh phù hợp."
              meta={<span className="manager-pill">Đang dùng</span>}
              onClick={() =>
                setDetail({ kind: "salon", title: "QR chung của salon", qrUrl: salonQrUrl })
              }
            />
          ) : null}
          {branches.map((branch) => (
            <ActionRow
              key={branch.id}
              icon={MapPin}
              title={branch.name}
              description={branch.address || "Chưa có địa chỉ"}
              meta={
                <span className={branch.isActive ? "manager-pill" : "manager-pill muted"}>
                  {branch.isActive ? "Đang mở" : "Đã khóa"}
                </span>
              }
              onClick={() => setDetail({ kind: "branch", branch })}
            />
          ))}
        </div>
      )}

      {!loading && branches.length === 0 ? (
        <EmptyState
          icon={<MapPin aria-hidden="true" />}
          title="Chưa có chi nhánh"
          description="Tạo chi nhánh đầu tiên hoặc chuyển dữ liệu Gương 1 cũ."
        />
      ) : null}

      <button
        className="manager-button secondary wide"
        type="button"
        disabled={busy === "migration"}
        onClick={() =>
          onConfirm({
            title: "Chuyển dữ liệu Gương 1 cũ?",
            description:
              "Dữ liệu cũ được gắn vào Chi nhánh chính. Có thể chạy lại mà không tạo trùng.",
            confirmLabel: "Bắt đầu chuyển",
            onConfirm: migrate,
          })
        }
      >
        <RefreshCcw aria-hidden="true" />
        {busy === "migration" ? "Đang chuyển..." : "Chuyển dữ liệu Gương 1 cũ"}
      </button>

      {message ? <InlineFeedback tone="success">{message}</InlineFeedback> : null}
      {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}
    </div>
  );
}

function QrDetail({
  target,
  salonId,
  busy,
  onBack,
  onBusy,
  onMessage,
  onError,
  onConfirm,
  onSalonQrChange,
  onBranchChange,
}: {
  target: DetailTarget;
  salonId: string;
  busy: string;
  onBack: () => void;
  onBusy: (value: string) => void;
  onMessage: (value: string) => void;
  onError: (value: string) => void;
  onConfirm: (request: ConfirmDialogRequest) => void;
  onSalonQrChange: (url: string) => void;
  onBranchChange: (branch: SalonBranch) => void;
}) {
  const branch = target.kind === "branch" ? target.branch : null;
  const title = target.kind === "salon" ? target.title : target.branch.name;
  const qrUrl = target.kind === "salon" ? target.qrUrl : target.branch.qrUrl;
  const [name, setName] = useState(branch?.name || "");
  const [address, setAddress] = useState(branch?.address || "");
  const [phone, setPhone] = useState(branch?.phone || "");
  const [qrImage, setQrImage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(qrUrl, {
      width: 320,
      margin: 2,
      color: { dark: "#10231d", light: "#ffffff" },
    })
      .then((image) => {
        if (!cancelled) setQrImage(image);
      })
      .catch(() => {
        if (!cancelled) setQrImage("");
      });
    return () => {
      cancelled = true;
    };
  }, [qrUrl]);

  async function save() {
    if (!branch) return;
    onBusy(branch.id);
    onError("");
    onMessage("");
    try {
      const updated = await updateBranch({
        salonId,
        branchId: branch.id,
        name,
        address,
        phone,
      });
      onBranchChange(updated);
      onMessage("Đã cập nhật chi nhánh.");
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Không cập nhật được chi nhánh.");
    } finally {
      onBusy("");
    }
  }

  async function toggle() {
    if (!branch) return;
    onBusy(branch.id);
    onError("");
    try {
      const updated = await updateBranch({
        salonId,
        branchId: branch.id,
        isActive: !branch.isActive,
      });
      onBranchChange(updated);
      onMessage(updated.isActive ? "Đã mở lại chi nhánh." : "Đã khóa chi nhánh.");
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Không đổi được trạng thái chi nhánh.");
    } finally {
      onBusy("");
    }
  }

  async function rotate() {
    const busyKey = branch?.id || "salon-qr";
    onBusy(busyKey);
    onMessage("");
    onError("");
    try {
      if (branch) {
        const url = await rotateBranchQr(salonId, branch.id);
        onBranchChange({ ...branch, qrUrl: url });
        onMessage("Đã tạo QR chi nhánh mới. QR chung không thay đổi.");
      } else {
        const url = await rotateSalonQr(salonId);
        onSalonQrChange(url);
        onMessage("Đã tạo QR salon mới. QR chi nhánh không thay đổi.");
      }
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Không tạo lại được QR.");
    } finally {
      onBusy("");
    }
  }

  function printQr() {
    if (!qrImage) return;
    const popup = window.open("", "_blank", "width=420,height=620");
    if (!popup) {
      onError("Trình duyệt đang chặn cửa sổ in.");
      return;
    }
    popup.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8">
      <title>${escapeHtml(title)} - HAIRCUT QR</title>
      <style>body{font-family:Arial,sans-serif;text-align:center;margin:28px;color:#10231d}
      h1{font-size:26px;margin:0 0 8px}p{color:#52635b}img{width:300px;height:300px}</style>
      </head><body><h1>${escapeHtml(title)}</h1><p>Quét QR để check-in HAIRCUT</p>
      <img src="${qrImage}" alt=""><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }

  return (
    <div className="manager-subscreen">
      <DetailHeader
        title={title}
        description={branch?.address || "QR nhận khách của salon"}
        onBack={onBack}
      />
      <Section className="manager-qr-section">
        <div className="manager-qr-preview">
          {qrImage ? <img src={qrImage} alt={`Mã QR ${title}`} /> : <QrCode aria-hidden="true" />}
        </div>
        <p className="manager-field-note">
          Không chia sẻ ảnh này ngoài vị trí tiếp khách của salon.
        </p>
        <div className="manager-button-grid">
          {window.__haircutNativeShare ? (
            <button
              className="manager-button secondary"
              type="button"
              onClick={() => void window.__haircutNativeShare?.(qrUrl, title)}
            >
              <Share2 aria-hidden="true" />
              Chia sẻ
            </button>
          ) : null}
          <button
            className="manager-button secondary"
            type="button"
            onClick={() =>
              void navigator.clipboard
                .writeText(qrUrl)
                .then(() => onMessage("Đã sao chép liên kết QR."))
                .catch(() => onError("Thiết bị không cho phép sao chép."))
            }
          >
            <Copy aria-hidden="true" />
            Sao chép
          </button>
          <a
            className="manager-button secondary"
            href={qrImage}
            download={`${safeFileName(title)}-qr.png`}
            aria-disabled={!qrImage}
          >
            <Download aria-hidden="true" />
            Tải QR
          </a>
          <button
            className="manager-button secondary"
            type="button"
            disabled={!qrImage}
            onClick={printQr}
          >
            <Printer aria-hidden="true" />
            In QR
          </button>
        </div>
      </Section>

      {branch ? (
        <Section title="Thông tin chi nhánh">
          <label className="manager-field">
            <span>Tên chi nhánh</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="manager-field">
            <span>Địa chỉ</span>
            <input value={address} onChange={(event) => setAddress(event.target.value)} />
          </label>
          <label className="manager-field">
            <span>Số điện thoại</span>
            <input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <button
            className="manager-button primary wide"
            type="button"
            disabled={busy === branch.id || !name.trim()}
            onClick={() => void save()}
          >
            <Save aria-hidden="true" />
            {busy === branch.id ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
          <button
            className="manager-button secondary wide"
            type="button"
            disabled={busy === branch.id}
            onClick={() =>
              onConfirm({
                title: branch.isActive ? "Khóa chi nhánh?" : "Mở lại chi nhánh?",
                description: branch.isActive
                  ? "QR chi nhánh này sẽ không tạo được lượt mới."
                  : "Khách có thể check-in lại tại chi nhánh này.",
                confirmLabel: branch.isActive ? "Khóa chi nhánh" : "Mở lại",
                tone: branch.isActive ? "danger" : "default",
                onConfirm: toggle,
              })
            }
          >
            <Power aria-hidden="true" />
            {branch.isActive ? "Khóa chi nhánh" : "Mở lại chi nhánh"}
          </button>
        </Section>
      ) : null}

      <Section title="Bảo mật QR" className="manager-danger-zone">
        <p className="manager-field-note">
          Khi tạo lại, QR cũ ngừng hoạt động ngay. Các QR khác không bị ảnh hưởng.
        </p>
        <button
          className="manager-button danger wide"
          type="button"
          disabled={Boolean(busy)}
          onClick={() =>
            onConfirm({
              title: `Tạo lại ${branch ? "QR chi nhánh" : "QR salon"}?`,
              description: `QR cũ của ${title} sẽ ngừng hoạt động ngay.`,
              confirmLabel: "Tạo QR mới",
              tone: "danger",
              onConfirm: rotate,
            })
          }
        >
          <RefreshCcw aria-hidden="true" />
          Tạo lại QR
        </button>
      </Section>
    </div>
  );
}
