import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  LogIn,
  Mail,
  Phone,
  Send,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { InlineFeedback, LoadingState } from "../components/Feedback";
import {
  completeOwnerSalonProfile,
  getAppUser,
  isValidAuthEmail,
  listenAuthState,
  registerOwnerSalon,
  requestOwnerStaffPasswordReset,
  signInOwnerStaff,
  signOutOwnerStaff,
  type AppRole,
  type AppUser,
} from "../services/managerApi";
import {
  clearMonitoringUser,
  setMonitoringUser,
  trackEvent,
} from "../services/monitoring";

type AuthMode = "signin" | "signup" | "reset";
type UnlinkedUser = { uid: string; email: string; displayName: string };

export function ManagerAuthGate({
  allowedRoles,
  children,
}: {
  allowedRoles: AppRole[];
  children: (user: AppUser) => ReactNode;
}) {
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
  const [resetSent, setResetSent] = useState(false);
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
        if (!profile?.salonId) {
          setAppUser(null);
          setUnlinkedUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || "",
          });
          setOwnerName((current) => current || firebaseUser.displayName || "");
          setEmail(firebaseUser.email || "");
          setError("Tài khoản chưa có salon. Hãy hoàn tất hồ sơ chủ salon.");
          return;
        }
        if (!profile.isActive) {
          setAppUser(null);
          setUnlinkedUser(null);
          setError("Tài khoản đang bị tắt. Vui lòng liên hệ chủ salon.");
          return;
        }
        setUnlinkedUser(null);
        setAppUser(profile);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Không tải được tài khoản.");
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
    setMonitoringUser({ uid: appUser.uid, role: appUser.role, salonId: appUser.salonId });
  }, [appUser]);

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      if (mode === "signup") {
        if (password !== confirmPassword) throw new Error("Mật khẩu nhập lại chưa khớp.");
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không xử lý được tài khoản.");
    } finally {
      setSubmitting(false);
    }
  }

  async function completeProfile() {
    setSubmitting(true);
    setError("");
    try {
      const profile = await completeOwnerSalonProfile({ ownerName, salonName, phone });
      setUnlinkedUser(null);
      setAppUser(profile);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không hoàn tất được hồ sơ.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword() {
    setSubmitting(true);
    setResetSent(false);
    setError("");
    try {
      await requestOwnerStaffPasswordReset(email);
      setResetSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không gửi được email.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="manager-auth-page">
        <BrandMark />
        <LoadingState label="Đang kiểm tra tài khoản" />
      </main>
    );
  }

  if (appUser && !allowedRoles.includes(appUser.role)) {
    return (
      <main className="manager-auth-page">
        <BrandMark />
        <section className="manager-auth-card">
          <ShieldCheck aria-hidden="true" />
          <h1>Không có quyền truy cập</h1>
          <p>Tài khoản này chưa được phân quyền vào HAIRCUT Manager.</p>
          <button className="manager-button secondary" onClick={() => void signOutOwnerStaff()}>
            Đăng xuất
          </button>
        </section>
      </main>
    );
  }

  if (appUser) return <>{children(appUser)}</>;

  if (unlinkedUser) {
    return (
      <main className="manager-auth-page">
        <BrandMark />
        <section className="manager-auth-card">
          <p className="manager-eyebrow">Thiết lập lần đầu</p>
          <h1>Hoàn tất hồ sơ salon</h1>
          <p>Tài khoản đã xác thực nhưng chưa được gắn với salon.</p>
          <Field icon={UserRound} label="Tên chủ salon">
            <input
              autoComplete="name"
              value={ownerName}
              onChange={(event) => setOwnerName(event.target.value)}
              placeholder="Ví dụ: Anh Trọng"
            />
          </Field>
          <Field icon={Building2} label="Tên salon">
            <input
              value={salonName}
              onChange={(event) => setSalonName(event.target.value)}
              placeholder="Ví dụ: HAIRCUT Studio"
            />
          </Field>
          <Field icon={Phone} label="SĐT salon">
            <input
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Không bắt buộc"
            />
          </Field>
          <button
            className="manager-button primary"
            disabled={submitting || !ownerName.trim() || !salonName.trim()}
            onClick={() => void completeProfile()}
          >
            <UserPlus aria-hidden="true" />
            {submitting ? "Đang tạo salon..." : "Tạo hồ sơ salon"}
          </button>
          <button
            className="manager-button secondary"
            disabled={submitting}
            onClick={() => void signOutOwnerStaff()}
          >
            Dùng tài khoản khác
          </button>
          {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}
        </section>
      </main>
    );
  }

  const signup = mode === "signup";
  const resetting = mode === "reset";
  return (
    <main className="manager-auth-page">
      <BrandMark />
      <section className="manager-auth-card">
        <p className="manager-eyebrow">Chủ salon và nhân viên</p>
        <h1>{resetting ? "Khôi phục mật khẩu" : signup ? "Tạo salon mới" : "Đăng nhập quản lý"}</h1>
        <p>
          {resetting
            ? "Nhập đúng email để nhận liên kết đặt lại mật khẩu."
            : signup
              ? "Chủ salon đăng ký tại đây. Nhân viên dùng email được mời."
              : "Dùng tài khoản đã được phân quyền tại salon."}
        </p>

        {!resetting ? (
          <div className="manager-segmented" aria-label="Chọn hình thức">
            <button className={!signup ? "active" : ""} onClick={() => setMode("signin")}>
              <LogIn aria-hidden="true" />
              Đăng nhập
            </button>
            <button className={signup ? "active" : ""} onClick={() => setMode("signup")}>
              <UserPlus aria-hidden="true" />
              Đăng ký
            </button>
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void (resetting ? resetPassword() : submit());
          }}
        >
          {signup ? (
            <>
              <Field icon={UserRound} label="Tên chủ salon">
                <input
                  autoComplete="name"
                  value={ownerName}
                  onChange={(event) => setOwnerName(event.target.value)}
                />
              </Field>
              <Field icon={Building2} label="Tên salon">
                <input value={salonName} onChange={(event) => setSalonName(event.target.value)} />
              </Field>
            </>
          ) : null}

          <Field icon={Mail} label="Email">
            <input
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setResetSent(false);
              }}
              placeholder="email@salon.com"
            />
          </Field>

          {!resetting ? (
            <Field icon={KeyRound} label="Mật khẩu">
              <input
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={signup ? "Tối thiểu 8 ký tự" : "Mật khẩu"}
              />
            </Field>
          ) : null}

          {signup ? (
            <>
              <Field icon={KeyRound} label="Nhập lại mật khẩu">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </Field>
              <Field icon={Phone} label="SĐT salon">
                <input
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Không bắt buộc"
                />
              </Field>
            </>
          ) : null}

          {!signup && !resetting ? (
            <button className="manager-text-button" type="button" onClick={() => setMode("reset")}>
              Quên mật khẩu?
            </button>
          ) : null}

          <button
            className="manager-button primary"
            type="submit"
            disabled={
              submitting ||
              !isValidAuthEmail(email) ||
              (!resetting && password.length < (signup ? 8 : 6)) ||
              (signup &&
                (!ownerName.trim() || !salonName.trim() || password !== confirmPassword))
            }
          >
            {resetting ? <Send aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
            {submitting
              ? "Đang xử lý..."
              : resetting
                ? "Gửi email đặt lại mật khẩu"
                : signup
                  ? "Tạo salon"
                  : "Đăng nhập"}
          </button>
          {resetting ? (
            <button
              className="manager-button secondary"
              type="button"
              onClick={() => {
                setMode("signin");
                setError("");
                setResetSent(false);
              }}
            >
              <ArrowLeft aria-hidden="true" />
              Quay lại đăng nhập
            </button>
          ) : null}
        </form>

        {resetSent ? (
          <InlineFeedback tone="success">
            <CheckCircle2 aria-hidden="true" />
            Nếu email khớp tài khoản, liên kết đặt lại mật khẩu đã được gửi.
          </InlineFeedback>
        ) : null}
        {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}
      </section>
    </main>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="manager-field">
      <span>
        <Icon aria-hidden="true" />
        {label}
      </span>
      {children}
    </label>
  );
}
