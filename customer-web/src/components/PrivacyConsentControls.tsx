import { useEffect, useRef, useState } from "react";
import { applyMonitoringPrivacyPreference } from "../services/monitoring";
import {
  PRIVACY_PREFERENCES_EVENT,
  PRIVACY_PREFERENCES_KEY,
  readPrivacyPreferences,
  savePrivacyPreferences,
} from "../services/privacyPreferences";

export function PrivacyConsentControls() {
  const [open, setOpen] = useState(() => readPrivacyPreferences() === null);
  const [error, setError] = useState("");
  const settingsButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function refresh(event: Event) {
      if (
        event instanceof StorageEvent &&
        event.key !== null &&
        event.key !== PRIVACY_PREFERENCES_KEY
      )
        return;
      if (readPrivacyPreferences() === null) setOpen(true);
      if (event instanceof CustomEvent && event.detail?.open === true) setOpen(true);
      applyMonitoringPrivacyPreference();
    }
    window.addEventListener(PRIVACY_PREFERENCES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    applyMonitoringPrivacyPreference();
    return () => {
      window.removeEventListener(PRIVACY_PREFERENCES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  function choose(optional: boolean) {
    if (!savePrivacyPreferences(optional)) {
      setError("Chưa lưu được lựa chọn trên trình duyệt. Thống kê vẫn tắt.");
      return;
    }
    setError("");
    setOpen(false);
    settingsButton.current?.focus();
  }

  return (
    <div className="privacy-controls">
      {open && (
        <aside
          id="privacy-preferences-panel"
          className="privacy-choice"
          aria-label="Lựa chọn quyền riêng tư"
        >
          <h2>Quyền riêng tư của bạn</h2>
          <p>
            Thống kê chỉ bật khi bạn cho phép. Từ chối không ảnh hưởng đăng nhập và tích điểm.{" "}
            <a href="/cookies">Xem cookie và dữ liệu trên thiết bị</a>.
          </p>
          <div className="privacy-choice-actions">
            <button type="button" className="secondary-button" onClick={() => choose(false)}>
              Chỉ dùng thiết yếu
            </button>
            <button type="button" className="secondary-button" onClick={() => choose(true)}>
              Cho phép thống kê
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </aside>
      )}
      <nav className="privacy-settings-links" aria-label="Quyền riêng tư">
        <button
          ref={settingsButton}
          type="button"
          className="privacy-settings-button"
          aria-expanded={open}
          aria-controls="privacy-preferences-panel"
          onClick={() => setOpen((value) => !value)}
        >
          Cài đặt quyền riêng tư
        </button>
        <a href="/data-rights">Quyền dữ liệu</a>
      </nav>
    </div>
  );
}
