import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import {
  callFunction,
  getFirebaseAuth,
  getFirebaseDb,
  getFunctionWriteMode,
  isFirebaseConfigured,
} from "./firebase";
import { callWriteFunctionOrFallback } from "./functionWrites";
import { defaultLuckyWheelConfig } from "./types";

export type AppRole = "owner" | "staff";

export type AppUser = {
  uid: string;
  salonId: string;
  name: string;
  avatarUrl: string;
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

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
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

  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    if (authErrorCode(err) !== "auth/email-already-in-use") {
      throw new Error(friendlyAuthError(err));
    }

    credential = await signInWithEmailAndPassword(auth, email, password);
  }

  await updateProfile(credential.user, { displayName: ownerName });
  const existingProfile = await getAppUser(credential.user.uid);

  if (existingProfile) {
    return existingProfile;
  }

  try {
    await callFunction(
      "createSalon",
      {
        name: salonName,
        ownerName,
        phone,
      },
    );
  } catch (err) {
    if (getFunctionWriteMode() === "required") {
      throw err;
    }

    await createOwnerSalonDirect({
      uid: credential.user.uid,
      ownerName,
      salonName,
      phone,
    });
  }

  const profile = await getAppUser(credential.user.uid);
  if (!profile) {
    throw new Error("Đã tạo tài khoản nhưng chưa tải được hồ sơ chủ salon");
  }

  return profile;
}

export async function completeOwnerSalonProfile(input: {
  ownerName: string;
  salonName: string;
  phone?: string;
}): Promise<AppUser> {
  const auth = getFirebaseAuth();
  const currentUser = auth?.currentUser;

  if (!currentUser) {
    throw new Error("Bạn cần đăng nhập trước khi hoàn tất hồ sơ salon");
  }

  const ownerName = input.ownerName.trim();
  const salonName = input.salonName.trim();
  const phone = input.phone?.trim() || undefined;

  if (!ownerName || !salonName) {
    throw new Error("Vui lòng nhập tên chủ salon và tên salon");
  }

  await updateProfile(currentUser, { displayName: ownerName });
  const existingProfile = await getAppUser(currentUser.uid);

  if (existingProfile) {
    return existingProfile;
  }

  try {
    await callFunction(
      "createSalon",
      {
        name: salonName,
        ownerName,
        phone,
      },
    );
  } catch (err) {
    if (getFunctionWriteMode() === "required") {
      throw err;
    }

    await createOwnerSalonDirect({
      uid: currentUser.uid,
      ownerName,
      salonName,
      phone,
    });
  }

  const profile = await getAppUser(currentUser.uid);
  if (!profile) {
    throw new Error("Đã tạo salon nhưng chưa tải được hồ sơ chủ salon");
  }

  return profile;
}

async function createOwnerSalonDirect(input: {
  uid: string;
  ownerName: string;
  salonName: string;
  phone?: string;
}) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase chưa được cấu hình");
  }

  const salonRef = doc(collection(db, "salons"));
  const mirrorRef = doc(collection(db, "mirrors"));
  const userRef = doc(db, "users", input.uid);
  const wheelRef = doc(db, "lucky_wheel", salonRef.id);
  const qrToken = randomToken();
  const now = serverTimestamp();
  const batch = writeBatch(db);

  batch.set(salonRef, {
    name: input.salonName,
    address: null,
    phone: input.phone ?? null,
    ownerId: input.uid,
    plan: "free",
    freeCustomerLimit: 50,
    pointPerVisit: 1,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(userRef, {
    salonId: salonRef.id,
    name: input.ownerName,
    avatarUrl: "",
    phone: input.phone ?? null,
    role: "owner",
    isActive: true,
    canRedeemRewards: true,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(wheelRef, {
    salonId: salonRef.id,
    requiredPoints: defaultLuckyWheelConfig.requiredPoints,
    deductPointsAfterSpin: defaultLuckyWheelConfig.deductPointsAfterSpin,
    slots: defaultLuckyWheelConfig.slots,
    updatedAt: now,
  });

  batch.set(mirrorRef, {
    salonId: salonRef.id,
    name: "Gương 1",
    qrToken,
    qrUrl: buildQrUrl(salonRef.id, mirrorRef.id, qrToken),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await batch.commit();
}

export async function signOutOwnerStaff() {
  const auth = getFirebaseAuth();

  if (!auth) {
    return;
  }

  await signOut(auth);
}

export async function updateOwnerAvatar(input: {
  salonId: string;
  avatarUrl: string;
}): Promise<{ avatarUrl: string }> {
  const avatarUrl = input.avatarUrl.trim();

  if (avatarUrl) {
    let parsed: URL;
    try {
      parsed = new URL(avatarUrl);
    } catch {
      throw new Error("Link avatar không hợp lệ");
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Avatar phải dùng link http hoặc https");
    }
  }

  const result = await callWriteFunctionOrFallback<{ salonId: string; avatarUrl: string }, { avatarUrl: string }>(
    "updateOwnerAvatar",
    {
      salonId: input.salonId,
      avatarUrl,
    },
    () => updateOwnerAvatarDirect(avatarUrl),
  );
  const auth = getFirebaseAuth();

  if (auth?.currentUser) {
    await updateProfile(auth.currentUser, { photoURL: result.avatarUrl || null });
  }

  return result;
}

async function updateOwnerAvatarDirect(avatarUrl: string): Promise<{ avatarUrl: string }> {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();

  if (!auth?.currentUser || !db) {
    throw new Error("Bạn cần đăng nhập chủ salon để đổi avatar");
  }

  await setDoc(doc(db, "users", auth.currentUser.uid), {
    avatarUrl: avatarUrl || null,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return { avatarUrl };
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
    avatarUrl: String(data.avatarUrl || ""),
    role,
    isActive: Boolean(data.isActive),
    canRedeemRewards: Boolean(data.canRedeemRewards),
  };
}

function buildQrUrl(salonId: string, mirrorId: string, qrToken: string) {
  const params = new URLSearchParams({ salonId, mirrorId, qrToken });
  const miniAppId = String(import.meta.env.VITE_ZALO_MINI_APP_ID || "").trim();

  if (miniAppId) {
    return `https://zalo.me/s/${miniAppId}?${params.toString()}`;
  }

  return `${window.location.origin}/?${params.toString()}`;
}

function randomToken() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID().replace(/-/g, "");
  }

  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function authErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
}

function friendlyAuthError(error: unknown) {
  const code = authErrorCode(error);

  if (code === "auth/operation-not-allowed") {
    return "Firebase Auth chưa bật Email/Password. Vào Firebase Console > Authentication > Sign-in method để bật.";
  }
  if (code === "auth/email-already-in-use") {
    return "Email này đã có tài khoản. Hãy đăng nhập hoặc dùng đúng mật khẩu cũ để hoàn tất tạo hồ sơ salon.";
  }
  if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
    return "Email hoặc mật khẩu không đúng.";
  }
  if (code === "auth/user-not-found") {
    return "Không tìm thấy tài khoản với email này.";
  }
  if (code === "auth/weak-password") {
    return "Mật khẩu phải có ít nhất 6 ký tự.";
  }
  if (code === "auth/invalid-email") {
    return "Email không hợp lệ.";
  }

  return error instanceof Error ? error.message : "Không xử lý được tài khoản";
}
