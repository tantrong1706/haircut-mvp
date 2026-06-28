import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from "./firebase";

export type AppRole = "owner" | "staff";

export type AppUser = {
  uid: string;
  salonId: string;
  name: string;
  role: AppRole;
  isActive: boolean;
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
  };
}

