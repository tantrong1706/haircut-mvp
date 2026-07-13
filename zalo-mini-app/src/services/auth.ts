import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  callFunction,
  getFirebaseAuth,
  getFirebaseDb,
  getFirebaseStorage,
  isFirebaseConfigured,
} from "./firebase";
import { callWriteFunctionOrFallback } from "./functionWrites";

export type AppRole = "owner" | "staff";

export type AppUser = {
  uid: string;
  salonId: string;
  name: string;
  avatarUrl: string;
  role: AppRole;
  isActive: boolean;
  canRedeemRewards?: boolean;
  branchId?: string;
  branchIds?: string[];
};

const OWNER_AVATAR_MAX_SOURCE_SIZE = 10 * 1024 * 1024;
const OWNER_AVATAR_MAX_UPLOAD_SIZE = 3 * 1024 * 1024;
const OWNER_AVATAR_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  if (password.length < 8) {
    throw new Error("Mật khẩu chủ salon phải có ít nhất 8 ký tự");
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

  if (existingProfile?.salonId) {
    return existingProfile;
  }

  if (!credential.user.emailVerified) {
    try {
      await sendEmailVerification(credential.user);
    } finally {
      await signOut(auth);
    }
    throw new Error("Đã gửi email xác minh. Hãy xác minh email rồi đăng nhập để tạo salon");
  }

  await callFunction("createSalon", {
    name: salonName,
    ownerName,
    phone,
  });

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

  await currentUser.reload();
  const verifiedUser = auth?.currentUser;
  if (!verifiedUser?.emailVerified) {
    throw new Error("Hãy xác minh email chủ salon rồi đăng nhập lại để tạo salon");
  }

  const ownerName = input.ownerName.trim();
  const salonName = input.salonName.trim();
  const phone = input.phone?.trim() || undefined;

  if (!ownerName || !salonName) {
    throw new Error("Vui lòng nhập tên chủ salon và tên salon");
  }

  await updateProfile(verifiedUser, { displayName: ownerName });
  const existingProfile = await getAppUser(verifiedUser.uid);

  if (existingProfile?.salonId) {
    return existingProfile;
  }

  await callFunction("createSalon", {
    name: salonName,
    ownerName,
    phone,
  });

  const profile = await getAppUser(verifiedUser.uid);
  if (!profile) {
    throw new Error("Đã tạo salon nhưng chưa tải được hồ sơ chủ salon");
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

  const result = await callWriteFunctionOrFallback<
    { salonId: string; avatarUrl: string },
    { avatarUrl: string }
  >(
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

export async function uploadOwnerAvatarFile(input: {
  salonId: string;
  file: File;
}): Promise<{ avatarUrl: string }> {
  const auth = getFirebaseAuth();
  const storage = getFirebaseStorage();
  const currentUser = auth?.currentUser;

  if (!currentUser || !storage) {
    throw new Error("Bạn cần đăng nhập chủ salon để tải avatar lên");
  }

  const sourceFile = validateOwnerAvatarFile(input.file);
  const avatarBlob = await resizeOwnerAvatar(sourceFile);

  if (avatarBlob.size > OWNER_AVATAR_MAX_UPLOAD_SIZE) {
    throw new Error("Ảnh avatar quá lớn. Vui lòng chọn ảnh nhẹ hơn 3MB.");
  }

  const avatarRef = ref(storage, `salons/${input.salonId}/owner_avatars/${currentUser.uid}/avatar`);

  await uploadBytes(avatarRef, avatarBlob, {
    contentType: avatarBlob.type || "image/webp",
    customMetadata: {
      salonId: input.salonId,
      ownerUid: currentUser.uid,
    },
  });

  const avatarUrl = await getDownloadURL(avatarRef);
  return updateOwnerAvatar({
    salonId: input.salonId,
    avatarUrl,
  });
}

async function updateOwnerAvatarDirect(avatarUrl: string): Promise<{ avatarUrl: string }> {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();

  if (!auth?.currentUser || !db) {
    throw new Error("Bạn cần đăng nhập chủ salon để đổi avatar");
  }

  await setDoc(
    doc(db, "users", auth.currentUser.uid),
    {
      avatarUrl: avatarUrl || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return { avatarUrl };
}

function validateOwnerAvatarFile(file: File) {
  if (!file) {
    throw new Error("Vui lòng chọn ảnh avatar");
  }

  if (!OWNER_AVATAR_ALLOWED_TYPES.has(file.type)) {
    throw new Error("Avatar chỉ hỗ trợ ảnh JPG, PNG hoặc WebP");
  }

  if (file.size > OWNER_AVATAR_MAX_SOURCE_SIZE) {
    throw new Error("Ảnh gốc quá lớn. Vui lòng chọn ảnh dưới 10MB.");
  }

  return file;
}

async function resizeOwnerAvatar(file: File): Promise<Blob> {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(imageUrl);
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);

    if (!sourceSize) {
      throw new Error("Không đọc được kích thước ảnh avatar");
    }

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
    const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);
    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 512, 512);

    const resizedBlob = await canvasToBlob(canvas, "image/webp", 0.86);
    return resizedBlob || file;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không đọc được ảnh avatar"));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
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
    branchId: String(data.branchId || ""),
    branchIds: Array.isArray(data.branchIds)
      ? data.branchIds.filter((value): value is string => typeof value === "string")
      : data.branchId
        ? [String(data.branchId)]
        : [],
  };
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
    return "Mật khẩu phải có ít nhất 8 ký tự.";
  }
  if (code === "auth/invalid-email") {
    return "Email không hợp lệ.";
  }

  return error instanceof Error ? error.message : "Không xử lý được tài khoản";
}
