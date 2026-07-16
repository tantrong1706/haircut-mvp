import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { LoaderCircle, LogOut, ShieldX } from "lucide-react";
import { AdminDashboard } from "./components/AdminDashboard";
import { LoginView } from "./components/LoginView";
import { auth, db } from "./services/firebase";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() =>
    onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthorized(false);
      if (nextUser) {
        const profile = await getDoc(doc(db, "users", nextUser.uid));
        setAuthorized(
          profile.exists() &&
          profile.data().role === "system_admin" &&
          profile.data().isActive === true,
        );
      }
      setLoading(false);
    }), []);

  if (loading) {
    return <main className="center-state"><LoaderCircle className="spin" /><p>Đang xác minh quyền quản trị...</p></main>;
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
        <button className="secondary" onClick={() => void signOut(auth)}><LogOut />Đăng xuất</button>
      </main>
    );
  }
  return <AdminDashboard user={user} />;
}
