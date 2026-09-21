export function extractRewardCode(rawValue: string) {
  const match = rawValue.trim().match(/^haircut-reward:v1:([A-Z0-9][A-Z0-9-]{5,79})$/iu);
  if (!match) throw new Error("QR quà không hợp lệ");
  return match[1].toUpperCase();
}

export async function startRewardQrCamera(video: HTMLVideoElement, onCode: (code: string) => void) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Trình duyệt này không cho phép mở camera. Hãy nhập mã quà bên dưới.");
  }

  const { BrowserQRCodeReader } = await import("@zxing/browser");
  const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 200 });
  let stopped = false;
  let controls: { stop: () => void } | null = null;
  const started = await reader.decodeFromConstraints(
    { audio: false, video: { facingMode: { ideal: "environment" } } },
    video,
    (result) => {
      if (!result || stopped) return;
      try {
        const rewardCode = extractRewardCode(result.getText());
        stopped = true;
        onCode(rewardCode);
        controls?.stop();
      } catch {
        // Keep scanning when the camera sees a QR that is not a CH Hair reward.
      }
    },
  );
  controls = started;
  if (stopped) started.stop();

  return () => {
    stopped = true;
    started.stop();
  };
}
