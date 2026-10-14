import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { LoaderCircle, LogOut, ShieldX } from "lucide-react";
import { AdminDashboard } from "./components/AdminDashboard";
import { LoginView } from "./components/LoginView";
import { auth } from "./services/firebase";
import { adminApi } from "./services/adminApi";
import { adminErrorMessage } from "./services/adminSupport";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      const request = ++generation;
      setUser(nextUser);
      setAuthorized(false);
      setError("");
      setLoading(Boolean(nextUser));
      if (!nextUser) return;
      try {
        const result = await adminApi.access();
        if (request === generation) setAuthorized(result.authorized === true);
      } catch (caught) {
        if (request === generation)
          setError(`Chưa xác minh được quyền quản trị. ${adminErrorMessage(caught)}`);
      } finally {
        if (request === generation) setLoading(false);
      }
    });
    return () => {
      generation++;
      unsubscribe();
    };
  }, [attempt]);

  if (loading) {
    return (
      <main className="center-state">
        <LoaderCircle className="spin" />
        <p>Đang xác minh quyền quản trị...</p>
      </main>
    );
  }
  if (!user) {
    return <LoginView />;
  }
  if (!authorized) {
    return (
      <main className="center-state">
        <ShieldX size={42} />
        <h1>Không có quyền truy cập</h1>
        <p>Tài khoản này chưa được cấp quyền quản trị hệ thống.</p>
        {error ? (
          <p className="notice error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="secondary" onClick={() => setAttempt((value) => value + 1)}>
          Kiểm tra quyền lại
        </button>
        <button className="secondary" onClick={() => void signOut(auth)}>
          <LogOut />
          Đăng xuất
        </button>
      </main>
    );
  }
  return <AdminDashboard key={user.uid} user={user} />;
}
