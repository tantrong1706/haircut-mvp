import { ScanLine, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { startRewardQrCamera } from "../services/rewardQrScanner";

export function RewardQrScanner({
  onCode,
  disabled = false,
}: {
  onCode: (code: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!open || !videoRef.current) return undefined;
    let active = true;
    let stop: (() => void) | undefined;
    setStarting(true);
    setError("");
    void startRewardQrCamera(videoRef.current, (code) => {
      if (!active) return;
      onCode(code);
      setOpen(false);
    })
      .then((nextStop) => {
        if (!active) nextStop();
        else stop = nextStop;
      })
      .catch((cameraError: unknown) => {
        if (active) {
          setError(
            cameraError instanceof Error
              ? cameraError.message
              : "Không mở được camera. Hãy nhập mã quà bên dưới.",
          );
        }
      })
      .finally(() => active && setStarting(false));
    return () => {
      active = false;
      stop?.();
    };
  }, [onCode, open]);

  return (
    <>
      <button
        className="secondary-button"
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <ScanLine size={18} aria-hidden="true" />
        Quét QR quà
      </button>

      {open ? (
        <div className="dialog-backdrop reward-scan-backdrop">
          <section
            className="confirm-dialog reward-scan-dialog"
            role="dialog"
            aria-label="Quét QR quà"
          >
            <button
              className="dialog-close"
              type="button"
              aria-label="Đóng camera"
              onClick={() => setOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
            <h2>Quét QR quà</h2>
            <p className="muted">Đưa QR quà của khách vào giữa khung hình.</p>
            <video ref={videoRef} autoPlay muted playsInline aria-label="Camera quét QR quà" />
            {starting ? <p role="status">Đang mở camera...</p> : null}
            {error ? (
              <p className="alert error" role="alert">
                {error}
              </p>
            ) : null}
            <p className="field-note">Không quét được thì đóng camera và nhập mã quà bên dưới.</p>
          </section>
        </div>
      ) : null}
    </>
  );
}
