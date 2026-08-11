import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { MINI_APP_NAME } from "../config/branding";
import { safeStorageGet, safeStorageSet } from "../services/safeStorage";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(
    () => safeStorageGet("haircut_install_hidden") === "1",
  );

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (!installEvent || hidden) {
    return null;
  }

  async function install() {
    if (!installEvent) {
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstallEvent(null);
    }
  }

  function dismiss() {
    safeStorageSet("haircut_install_hidden", "1");
    setHidden(true);
  }

  return (
    <div className="install-prompt">
      <div>
        <strong>Thêm {MINI_APP_NAME} vào màn hình chính</strong>
        <span>Mở nhanh như một app trên điện thoại salon.</span>
      </div>
      <button type="button" onClick={install}>
        <Download size={17} aria-hidden="true" />
        Thêm
      </button>
      <button className="icon-text-button" type="button" onClick={dismiss}>
        Để sau
      </button>
    </div>
  );
}
