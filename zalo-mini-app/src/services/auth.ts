import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { callFunction, getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from "./firebase";

export type AppRole = "owner" | "staff";

export type AppUser = {
  uid: string;
  salonId: string;
  name: string;
  role: AppRole;
  isActive: boolean;
  canRedeemRewards?: boolean;
};

export function listenAuthState(onChange: (user: User | null) => void) {
  const auth = getFirebaseAuth();

  if (!isFirebaseConfigured() || !auth) {
    onChange(null);
    return () => undefined;
  }

  return onAuthStateChanged(auth, onChange);
}

export async function signInOwnerStaff(email: string, password: string) {
  const auth = getFirebaseAuth();

  if (!auth) {
    throw new Error("Firebase Auth chưa được cấu hình");
  }

  await signInWithEmailAndPassword(auth, email, password);
}

export async function registerOwnerSalon(input: {
  email: string;
  password: string;
  ownerName: string;
  salonName: string;
  phone?: string;
}): Promise<AppUser> {
  const auth = getFirebaseAuth();

  if (!auth) {
    throw new Error("Firebase Auth chưa được cấu hình");
  }

  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const ownerName = input.ownerName.trim();
  const salonName = input.salonName.trim();
  const phone = input.phone?.trim() || undefined;

  if (!email || !password || !ownerName || !salonName) {
    throw new Error("Vui lòng nhập đủ thông tin đăng ký");
  }
  if (password.length < 6) {
    throw new Error("Mật khẩu phải có ít nhất 6 ký tự");
  }

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: ownerName });
  await callFunction(
    "createSalon",
    {
      name: salonName,
      ownerName,
      phone,
    },
  );

  const profile = await getAppUser(credential.user.uid);
  if (!profile) {
    throw new Error("Đã tạo tài khoản nhưng chưa tải được hồ sơ chủ salon");
  }

  return profile;
}

export async function signOutOwnerStaff() {
  const auth = getFirebaseAuth();

  if (!auth) {
    return;
  }

  await signOut(auth);
}

export async function getAppUser(uid: string): Promise<AppUser | null> {
  const db = getFirebaseDb();

  if (!db) {
    return null;
  }

  const snap = await getDoc(doc(db, "users", uid));

  if (!snap.exists()) {
    return null;
  }

  const data = snap.data();
  const role = data.role === "owner" ? "owner" : data.role === "staff" ? "staff" : null;

  if (!role) {
    return null;
  }

  return {
    uid,
    salonId: String(data.salonId || ""),
    name: String(data.name || ""),
    role,
    isActive: Boolean(data.isActive),
    canRedeemRewards: Boolean(data.canRedeemRewards),
  };
}
