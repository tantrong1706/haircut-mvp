import { AuthGate } from "../../../zalo-mini-app/src/pages/AuthGate";
import { OwnerPage } from "../../../zalo-mini-app/src/pages/OwnerPage";
import { StaffPage } from "../../../zalo-mini-app/src/pages/StaffPage";
import type { AppUser } from "../../../zalo-mini-app/src/services/auth";
import { NativeManagerShell } from "./NativeManagerShell";
import { initializeManagerFirebase } from "./services/firebase";

export function ManagerApp() {
  const firebase = initializeManagerFirebase();
  if (!firebase.ok) {
    return (
      <main className="manager-startup-error">
        <h1>Thiếu cấu hình HAIRCUT Manager</h1>
        <p>Ứng dụng chưa kết nối được Firebase. Vui lòng kiểm tra môi trường Manager.</p>
        <small>Mã lỗi: {firebase.code}</small>
      </main>
    );
  }

  return (
    <AuthGate allowedRoles={["owner", "staff"]}>
      {(user) => (
        <NativeManagerShell user={user}>
          {user.role === "owner" ? (
            <OwnerPage currentUser={user} />
          ) : (
            <StaffPage currentUser={user} />
          )}
        </NativeManagerShell>
      )}
    </AuthGate>
  );
}

export type ManagerUser = AppUser;
