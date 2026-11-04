import { useEffect, useRef, useState } from "react";
import { withdrawCustomerPhotoPermission } from "../services/customerPrivacy";
import type { AppSession } from "../services/types";

export function CustomerPrivacyPanel({
  session,
  onPhotoRevoked,
}: {
  session: AppSession;
  onPhotoRevoked?: () => void;
}) {
  const [revokedLocally, setRevokedLocally] = useState(false);
  const photoAllowed = session.customer.allowPhoto && !revokedLocally;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function withdraw() {
    if (pending.current || !photoAllowed) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await withdrawCustomerPhotoPermission(session.qr.salonId);
      if (!mounted.current) return;
      setRevokedLocally(true);
      setMessage("Đã ngừng cho phép lưu ảnh.");
      onPhotoRevoked?.();
    } catch (caught) {
      if (mounted.current)
        setError(
          caught instanceof Error ? caught.message : "Chưa lưu được lựa chọn. Vui lòng thử lại.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="panel customer-privacy-panel" aria-label="Quyền dữ liệu của khách">
      <h2>Quyền dữ liệu của bạn</h2>
      <p>
        {!photoAllowed
          ? "Ảnh đang được tắt cho hồ sơ tại salon này."
          : "Bạn đang cho phép salon lưu ảnh kiểu tóc."}{" "}
        Việc ngừng cho phép ảnh không xóa điểm hoặc quà.
      </p>
      <button
        type="button"
        className="secondary-button"
        disabled={busy || !photoAllowed}
        onClick={() => void withdraw()}
      >
        {busy ? "Đang cập nhật..." : "Ngừng cho phép lưu ảnh"}
      </button>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <p className="muted">
        Để cho phép ảnh ở lần phục vụ mới, bạn cần chọn lại khi check-in. Ngừng cho phép không tự
        xóa ảnh đã lưu; liên kết đã cấp hết hiệu lực theo thời hạn của chúng và không thể thu hồi
        bản đã tải về.
      </p>
      <a className="privacy-link" href="/data-rights">
        Yêu cầu xem, sửa hoặc xóa dữ liệu
      </a>
    </section>
  );
}
