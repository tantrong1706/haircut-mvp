import { useEffect, useState } from "react";
import { signOutCustomerWeb } from "../services/customerWebAuth";
import {
  customerPasskeysAvailable,
  customerPasskeyError,
  registerCustomerPasskey,
  signInCustomerPasskey,
  listCustomerPasskeys,
  removeCustomerPasskey,
} from "../services/customerPasskeys";

export function CustomerPasskeySignIn({
  disabled = false,
  onBusyChange,
}: {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!customerPasskeysAvailable()) return null;
  async function signIn() {
    if (busy || disabled) return;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      await signInCustomerPasskey();
    } catch (err) {
      setError(customerPasskeyError(err));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className="secondary-button"
        disabled={busy || disabled}
        onClick={() => void signIn()}
      >
        {busy ? "Đang xác nhận passkey..." : "Đăng nhập bằng passkey"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

export function CustomerPasskeyPanel({ onLoggedOut }: { onLoggedOut?: () => void }) {
  const available = customerPasskeysAvailable();
  const [keys, setKeys] = useState<Array<{ id: string; createdAtMs: number }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!available) return;
    let active = true;
    void listCustomerPasskeys()
      .then((result) => {
        if (active) setKeys(result.keys);
      })
      .catch((err: unknown) => {
        if (active) setError(customerPasskeyError(err));
      });
    return () => {
      active = false;
    };
  }, [available]);
  if (!available) return null;
  async function perform(action: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      if (
        result &&
        typeof result === "object" &&
        "requiresSignIn" in result &&
        result.requiresSignIn === true
      ) {
        await signOutCustomerWeb();
        onLoggedOut?.();
        return;
      }
      setKeys((await listCustomerPasskeys()).keys);
      setMessage(success);
    } catch (err) {
      setError(customerPasskeyError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel account-device" aria-labelledby="customer-passkeys-title">
      <div>
        <h2 id="customer-passkeys-title">Đăng nhập bằng passkey</h2>
        <p>
          Dùng khóa màn hình, vân tay hoặc khuôn mặt trên thiết bị hỗ trợ. OTP vẫn có thể dùng khi
          cần.
        </p>
        <p>
          Thêm khóa trong 5 phút sau khi xác thực OTP. Nếu phiên đã cũ, hãy đăng xuất và đăng nhập
          lại bằng OTP trước khi thêm.
        </p>
        <button
          className="secondary-button"
          type="button"
          disabled={busy || keys.length >= 10}
          onClick={() => void perform(registerCustomerPasskey, "Đã thêm passkey.")}
        >
          Thêm passkey
        </button>
        {keys.map((key, index) => (
          <button
            className="secondary-button"
            type="button"
            key={key.id}
            disabled={busy}
            onClick={() => void perform(() => removeCustomerPasskey(key.id), "Đã gỡ passkey.")}
          >
            Gỡ passkey {index + 1}
          </button>
        ))}
        {message ? <p role="status">{message}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </section>
  );
}
