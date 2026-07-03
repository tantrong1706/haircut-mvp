import { useEffect, useState, type ReactNode } from "react";
import {
  Building2,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import {
  AppRole,
  AppUser,
  getAppUser,
  listenAuthState,
  registerOwnerSalon,
  signInOwnerStaff,
  signOutOwnerStaff,
} from "../services/auth";

type Props = {
  allowedRoles: AppRole[];
  children: (user: AppUser) => ReactNode;
};

type AuthMode = "signin" | "signup";

export function AuthGate({ allowedRoles, children }: Props) {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [salonName, setSalonName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
          setError("Tài khoản này chưa được gắn vào salon. Chủ salon cần tạo hoặc kích hoạt tài khoản.");
          return;
        }

        if (!profile.isActive) {
          setAppUser(null);
          setError("Tài khoản này đang bị tắt. Vui lòng liên hệ chủ salon.");
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

  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    try {
      if (mode === "signup") {
        const profile = await registerOwnerSalon({
          email,
          password,
          ownerName,
          salonName,
          phone,
        });
        setAppUser(profile);
        return;
      }

      await signInOwnerStaff(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xử lý được tài khoản");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    await signOutOwnerStaff();
    setAppUser(null);
  }

  if (loading) {
    return (
      <section className="entry-page auth-entry">
        <div className="empty-state">
          <ShieldCheck size={32} aria-hidden="true" />
          <strong>Đang kiểm tra tài khoản</strong>
          <p>Hệ thống đang xác nhận quyền truy cập.</p>
        </div>
      </section>
    );
  }

  if (!appUser) {
    const isSignup = mode === "signup";

    return (
      <section className="entry-page auth-entry">
        <header className="entry-hero auth-hero premium-hero visual-hero">
          <BrandLogo />
          <p className="eyebrow">Chủ salon / Nhân viên</p>
          <h1>{isSignup ? "Đăng ký salon mới" : "Đăng nhập quản lý"}</h1>
          <p className="muted">
            {isSignup
              ? "Tạo tài khoản chủ salon. Nhân viên sẽ được chủ salon tạo tài khoản riêng."
              : "Dùng tài khoản đã được phân quyền trong salon."}
          </p>
        </header>

        <div className="segmented-control auth-tabs" aria-label="Chọn luồng tài khoản">
          <button className={!isSignup ? "active" : ""} onClick={() => setMode("signin")}>
            <LockKeyhole size={18} aria-hidden="true" />
            Đăng nhập
          </button>
          <button className={isSignup ? "active" : ""} onClick={() => setMode("signup")}>
            <UserPlus size={18} aria-hidden="true" />
            Đăng ký
          </button>
        </div>

        <div className="panel form-panel auth-panel">
          {isSignup ? (
            <>
              <label className="field">
                <span>
                  <UserRound size={18} aria-hidden="true" />
                  Tên chủ salon
                </span>
                <input
                  value={ownerName}
                  onChange={(event) => setOwnerName(event.target.value)}
                  autoComplete="name"
                  placeholder="Ví dụ: Anh Trọng"
                />
              </label>

              <label className="field">
                <span>
                  <Building2 size={18} aria-hidden="true" />
                  Tên salon
                </span>
                <input
                  value={salonName}
                  onChange={(event) => setSalonName(event.target.value)}
                  placeholder="Ví dụ: HAIRCUT Studio"
                />
              </label>
            </>
          ) : null}

          <label className="field">
            <span>
              <Mail size={18} aria-hidden="true" />
              Email
            </span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="email@salon.com"
            />
          </label>

          <label className="field">
            <span>
              <KeyRound size={18} aria-hidden="true" />
              Mật khẩu
            </span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder="Tối thiểu 6 ký tự"
            />
          </label>

          {isSignup ? (
            <label className="field">
              <span>
                <Phone size={18} aria-hidden="true" />
                SĐT salon
              </span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                placeholder="Không bắt buộc"
              />
            </label>
          ) : null}
        </div>

        <button
          className="primary-button"
          disabled={
            submitting ||
            !email.trim() ||
            password.length < 6 ||
            (isSignup && (!ownerName.trim() || !salonName.trim()))
          }
          onClick={handleSubmit}
        >
          {submitting ? (
            isSignup ? "Đang tạo tài khoản..." : "Đang đăng nhập..."
          ) : isSignup ? (
            <>
              <UserPlus size={20} aria-hidden="true" />
              Tạo salon
            </>
          ) : (
            <>
              <LockKeyhole size={20} aria-hidden="true" />
              Đăng nhập
            </>
          )}
        </button>

        <p className="field-note">
          Nhân viên đăng nhập bằng email và mật khẩu tạm thời do chủ salon tạo trong mục Nhân viên.
        </p>
        {error ? <p className="alert error">{error}</p> : null}
      </section>
    );
  }

  if (!allowedRoles.includes(appUser.role)) {
    return (
      <section className="entry-page auth-entry">
        <header className="page-header">
          <p className="eyebrow">Không có quyền</p>
          <h1>Tài khoản này không được vào trang này</h1>
          <p className="muted">Vai trò hiện tại: {roleLabel(appUser.role)}</p>
        </header>
        <button className="secondary-button" onClick={handleSignOut}>
          <LogOut size={18} aria-hidden="true" />
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
        <button onClick={handleSignOut}>
          <LogOut size={16} aria-hidden="true" />
          Đăng xuất
        </button>
      </div>
      {children(appUser)}
    </>
  );
}

function roleLabel(role: AppRole) {
  return role === "owner" ? "Chủ salon" : "Nhân viên";
}
