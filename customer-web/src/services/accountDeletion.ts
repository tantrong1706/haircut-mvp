import { EmailAuthProvider, reauthenticateWithCredential, signOut } from "firebase/auth";
import { callFunction, getFirebaseAuth } from "./firebase";

export type SalonDeletionStatus = {
  status: "none" | "requested" | "cancelled" | "completed" | string;
  executeAfterMs: number | null;
};

async function confirmCurrentPassword(password: string) {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user?.email) {
    throw new Error("Bạn cần đăng nhập bằng email để xác nhận thao tác này.");
  }
  if (!password) {
    throw new Error("Vui lòng nhập lại mật khẩu.");
  }
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    await user.getIdToken(true);
  } catch {
    throw new Error("Mật khẩu chưa đúng hoặc phiên đăng nhập không còn hợp lệ.");
  }
}

export async function deletePersonalAccount(password: string) {
  await confirmCurrentPassword(password);
  const result = await callFunction<Record<string, never>, { status: "completed" }>(
    "requestPersonalAccountDeletion",
    {},
  );
  const auth = getFirebaseAuth();
  if (auth) {
    await signOut(auth).catch(() => undefined);
  }
  return result;
}

export async function requestFullSalonDeletion(input: {
  salonId: string;
  salonName: string;
  password: string;
}) {
  await confirmCurrentPassword(input.password);
  return callFunction<
    { salonId: string; salonName: string },
    { status: "requested"; executeAfterMs: number; alreadyRequested: boolean }
  >("requestSalonDeletion", { salonId: input.salonId, salonName: input.salonName });
}

export async function cancelFullSalonDeletion(input: { salonId: string; password: string }) {
  await confirmCurrentPassword(input.password);
  return callFunction<{ salonId: string }, { status: "cancelled" }>("cancelSalonDeletion", {
    salonId: input.salonId,
  });
}

export function getFullSalonDeletionStatus(salonId: string) {
  return callFunction<{ salonId: string }, SalonDeletionStatus>("getSalonDeletionStatus", {
    salonId,
  });
}
