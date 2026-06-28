import { ReactNode, useEffect, useState } from "react";
import {
  AppRole,
  AppUser,
  getAppUser,
  listenAuthState,
  signInOwnerStaff,
  signOutOwnerStaff,
} from "../services/auth";

type Props = {
  allowedRoles: AppRole[];
  children: (user: AppUser) => ReactNode;
};

export function AuthGate({ allowedRoles, children }: Props) {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return listenAuthState(async (firebaseUser) => {
      setLoading(true);
      setError("");

      try {
        if (!firebaseUser) {
          setAppUser(null);
          return;
        }

        const profile = await getAppUser(firebaseUser.uid);

        if (!profile) {
          setAppUser(null);
          setError("Tài khoản chưa có hồ sơ phân quyền trong Firestore.");
          return;
        }

        if (!profile.isActive) {
          setAppUser(null);
          setError("Tài khoản chưa được chủ salon kích hoạt.");
          return;
        }

        setAppUser(profile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được tài khoản");
      } finally {
        setLoading(false);
      }
    });
  }, []);

  async function handleSignIn() {
    setSigningIn(true);
    setError("");

    try {
      await signInOwnerStaff(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đăng nhập được");
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    await signOutOwnerStaff();
    setAppUser(null);
  }

  if (loading) {
    return <p className="muted">Đang kiểm tra đăng nhập...</p>;
  }

  if (!appUser) {
    return (
      <section className="entry-page">
        <div className="brand-mark">HAIRCUT</div>
        <header className="page-header">
          <p className="eyebrow">Chủ salon / Nhân viên</p>
          <h1>Đăng nhập</h1>
          <p className="muted">Dùng email và mật khẩu đã tạo trong Firebase Authentication.</p>
        </header>

        <div className="panel">
          <label className="field">
            <span>Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="email@salon.com"
            />
          </label>

          <label className="field">
            <span>Mật khẩu</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>
        </div>

        <button
          className="primary-button"
          disabled={signingIn || !email.trim() || !password}
          onClick={handleSignIn}
        >
          {signingIn ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>

        {error ? <p className="error">{error}</p> : null}
      </section>
    );
  }

  if (!allowedRoles.includes(appUser.role)) {
    return (
      <section className="entry-page">
        <header className="page-header">
          <p className="eyebrow">Không có quyền</p>
          <h1>Tài khoản này không được vào trang này</h1>
          <p className="muted">Vai trò hiện tại: {roleLabel(appUser.role)}</p>
        </header>
        <button className="secondary-button" onClick={handleSignOut}>
          Đăng xuất
        </button>
      </section>
    );
  }

  return (
    <>
      <div className="auth-bar">
        <span>
          {appUser.name || appUser.uid} · {roleLabel(appUser.role)}
        </span>
        <button onClick={handleSignOut}>Đăng xuất</button>
      </div>
      {children(appUser)}
    </>
  );
}

function roleLabel(role: AppRole) {
  return role === "owner" ? "Chủ salon" : "Nhân viên";
}
