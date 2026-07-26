import { ManagerAuthGate } from "./app/ManagerAuthGate";
import { ManagerPreview } from "./dev/ManagerPreview";
import { OwnerWorkspace } from "./features/owner/OwnerWorkspace";
import { StaffWorkspace } from "./features/staff/StaffWorkspace";
import { NativeManagerShell } from "./NativeManagerShell";
import { initializeManagerFirebase } from "./services/firebase";
import type { AppUser } from "./services/managerApi";

export function ManagerApp() {
  const previewScenario = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get("preview") || ""
    : "";
  if (previewScenario) {
    return <ManagerPreview scenario={previewScenario} />;
  }

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
    <ManagerAuthGate allowedRoles={["owner", "staff"]}>
      {(user) => (
        <NativeManagerShell user={user}>
          {user.role === "owner" ? (
            <OwnerWorkspace currentUser={user} />
          ) : (
            <StaffWorkspace currentUser={user} />
          )}
        </NativeManagerShell>
      )}
    </ManagerAuthGate>
  );
}

export type ManagerUser = AppUser;
