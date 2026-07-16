import { AuthGate } from "../../../zalo-mini-app/src/pages/AuthGate";
import { OwnerPage } from "../../../zalo-mini-app/src/pages/OwnerPage";
import { StaffPage } from "../../../zalo-mini-app/src/pages/StaffPage";
import type { AppUser } from "../../../zalo-mini-app/src/services/auth";
import { NativeManagerShell } from "./NativeManagerShell";

export function ManagerApp() {
  return (
    <AuthGate allowedRoles={["owner", "staff"]}>
      {(user) => (
        <NativeManagerShell user={user}>
          {user.role === "owner" ? <OwnerPage currentUser={user} /> : <StaffPage currentUser={user} />}
        </NativeManagerShell>
      )}
    </AuthGate>
  );
}

export type ManagerUser = AppUser;
