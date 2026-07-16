import { useState, type FormEvent } from "react";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { KeyRound, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { auth } from "../services/firebase";

export function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setError("Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError("Nhập email quản trị trước khi yêu cầu đặt lại mật khẩu.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage("Đã gửi email đặt lại mật khẩu nếu tài khoản tồn tại.");
    } catch {
      setError("Chưa thể gửi email đặt lại mật khẩu. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="brand-lockup">
          <span className="brand-symbol"><ShieldCheck aria-hidden="true" /></span>
          <div><strong>HAIRCUT</strong><small>Quản trị hệ thống</small></div>
        </div>
        <div className="login-copy">
          <p className="eyebrow">Khu vực nội bộ</p>
          <h1 id="login-title">Đăng nhập quản trị</h1>
          <p>Chỉ tài khoản được cấp role system_admin mới có thể truy cập.</p>
        </div>
        <form onSubmit={login} className="login-form">
          <label>
            <span>Email</span>
            <div className="input-with-icon"><Mail aria-hidden="true" /><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          </label>
          <label>
            <span>Mật khẩu</span>
            <div className="input-with-icon"><KeyRound aria-hidden="true" /><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
          </label>
          {error ? <p className="notice error" role="alert">{error}</p> : null}
          {message ? <p className="notice success" role="status">{message}</p> : null}
          <button className="primary" disabled={busy} type="submit">
            {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
            Đăng nhập
          </button>
          <button className="text-button" disabled={busy} type="button" onClick={resetPassword}>Quên mật khẩu</button>
        </form>
      </section>
    </main>
  );
}
