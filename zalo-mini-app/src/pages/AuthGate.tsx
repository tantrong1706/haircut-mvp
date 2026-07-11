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
  completeOwnerSalonProfile,
  getAppUser,
  listenAuthState,
  registerOwnerSalon,
  signInOwnerStaff,
  signOutOwnerStaff,
} from "../services/auth";
import { clearMonitoringUser, setMonitoringUser, trackEvent } from "../services/monitoring";

type Props = {
  allowedRoles: AppRole[];
  children: (user: AppUser) => ReactNode;
};

type AuthMode = "signin" | "signup";

type UnlinkedUser = {
  uid: string;
  email: string;
  displayName: string;
};

export function AuthGate({ allowedRoles, children }: Props) {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [unlinkedUser, setUnlinkedUser] = useState<UnlinkedUser | null>(null);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [salonName, setSalonName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profileCompletionAttempted, setProfileCompletionAttempted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return listenAuthState(async (firebaseUser) => {
      setLoading(true);
      setError("");

      try {
        if (!firebaseUser) {
          setAppUser(null);
          setUnlinkedUser(null);
          return;
        }

        const profile = await getAppUser(firebaseUser.uid);

        if (!profile || !profile.salonId) {
          setAppUser(null);
          setUnlinkedUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || "",
          });
          setOwnerName((current) => current || firebaseUser.displayName || "");
          setEmail(firebaseUser.email || "");
          setMode("signin");
          setProfileCompletionAttempted(false);
          setError("Tài khoản này chưa có salon. Hoàn tất hồ sơ để tạo salon thật.");
          return;
        }

        if (!profile.isActive) {
          setAppUser(null);
          setUnlinkedUser(null);
          setError("Tài khoản này đang bị tắt. Vui lòng liên hệ chủ salon.");
          return;
        }

        setUnlinkedUser(null);
        setAppUser(profile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được tài khoản");
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!appUser) {
      clearMonitoringUser();
      return;
    }

    setMonitoringUser({
      uid: appUser.uid,
      role: appUser.role,
      salonId: appUser.salonId,
    });
    trackEvent("ops_user_authenticated", {
      role: appUser.role,
      salon_id: appUser.salonId,
    });
  }, [appUser?.uid, appUser?.role, appUser?.salonId]);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    trackEvent(mode === "signup" ? "owner_signup_started" : "ops_signin_started", {
      auth_mode: mode,
    });

    try {
      if (mode === "signup") {
        if (password !== confirmPassword) {
          throw new Error("Mật khẩu nhập lại chưa khớp");
        }

        const profile = await registerOwnerSalon({
          email,
          password,
          ownerName,
          salonName,
          phone,
        });
        setAppUser(profile);
        trackEvent("owner_signup_completed", {
          salon_id: profile.salonId,
        });
        return;
      }

      await signInOwnerStaff(email.trim(), password);
      trackEvent("ops_signin_completed", {
        auth_mode: mode,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xử lý được tài khoản");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteOwnerProfile() {
    setSubmitting(true);
    setProfileCompletionAttempted(true);
    setError("");
    trackEvent("owner_profile_completion_started", {
      has_console_user: Boolean(unlinkedUser?.uid),
    });

    try {
      const profile = await completeOwnerSalonProfile({
        ownerName,
        salonName,
        phone,
      });
      setUnlinkedUser(null);
      setProfileCompletionAttempted(false);
      setAppUser(profile);
      trackEvent("owner_profile_completion_completed", {
        salon_id: profile.salonId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không hoàn tất được hồ sơ salon");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    trackEvent("ops_signout", {
      role: appUser?.role || "unknown",
      salon_id: appUser?.salonId || "unknown",
    });
    await signOutOwnerStaff();
    clearMonitoringUser();
    setUnlinkedUser(null);
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

  if (!appUser && unlinkedUser) {
    return (
      <section className="entry-page auth-entry">
        <header className="entry-hero auth-hero premium-hero visual-hero">
          <BrandLogo />
          <p className="eyebrow">Thiết lập tài khoản</p>
          <h1>Hoàn tất hồ sơ salon</h1>
          <p className="muted">
            Tài khoản này đã có trong Firebase Auth nhưng chưa được gắn với salon.
          </p>
        </header>

        <div className="panel form-panel auth-panel">
          <div className="notice-banner account-notice">
            <ShieldCheck size={20} aria-hidden="true" />
            <span>{unlinkedUser.email || unlinkedUser.uid}</span>
          </div>

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
        </div>

        <button
          className="primary-button"
          disabled={submitting || !ownerName.trim() || !salonName.trim()}
          onClick={handleCompleteOwnerProfile}
        >
          {submitting ? (
            "Đang tạo hồ sơ..."
          ) : (
            <>
              <UserPlus size={20} aria-hidden="true" />
              Tạo hồ sơ chủ salon
            </>
          )}
        </button>

        <button className="secondary-button" disabled={submitting} onClick={handleSignOut}>
          <LogOut size={18} aria-hidden="true" />
          Đăng xuất tài khoản này
        </button>

        <p className="field-note">
          Nếu đây là tài khoản nhân viên, hãy đăng xuất và để chủ salon tạo nhân viên trong mục Nhân
          viên.
        </p>
        {profileCompletionAttempted && error ? <p className="alert error">{error}</p> : null}
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
          <button
            className={!isSignup ? "active" : ""}
            onClick={() => {
              setMode("signin");
              setError("");
            }}
          >
            <LockKeyhole size={18} aria-hidden="true" />
            Đăng nhập
          </button>
          <button
            className={isSignup ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
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
              placeholder={isSignup ? "Tối thiểu 8 ký tự" : "Mật khẩu"}
            />
          </label>

          {isSignup ? (
            <>
              <label className="field">
                <span>
                  <KeyRound size={18} aria-hidden="true" />
                  Nhập lại mật khẩu
                </span>
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu"
                />
              </label>

              <div className="password-checklist" aria-label="Độ an toàn mật khẩu">
                <span className={password.length >= 8 ? "ok" : ""}>8+ ký tự</span>
                <span className={/[A-Z]/.test(password) && /[a-z]/.test(password) ? "ok" : ""}>
                  Chữ hoa/thường
                </span>
                <span className={/\d/.test(password) ? "ok" : ""}>Có số</span>
                <span className={password && password === confirmPassword ? "ok" : ""}>Khớp</span>
              </div>

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
            </>
          ) : null}
        </div>

        <button
          className="primary-button"
          disabled={
            submitting ||
            !email.trim() ||
            password.length < (isSignup ? 8 : 6) ||
            (isSignup && (!ownerName.trim() || !salonName.trim() || password !== confirmPassword))
          }
          onClick={handleSubmit}
        >
          {submitting ? (
            isSignup ? (
              "Đang tạo tài khoản..."
            ) : (
              "Đang đăng nhập..."
            )
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
