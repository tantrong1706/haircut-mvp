import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

const defaultWheelSlots = [
  { label: "Giam 10%", active: true },
  { label: "Goi dau mien phi", active: true },
  { label: "Tang sap toc", active: true },
  { label: "Giam 20%", active: true },
  { label: "Chuc ban may man lan sau", active: true },
  { label: "Hap dau mien phi", active: true },
];

const toolDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(toolDir, "..");

loadDotEnv(resolve(appDir, ".env"));

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

const input = {
  email: readInput("email", "HAIRCUT_OWNER_EMAIL").trim().toLowerCase(),
  password: readInput("password", "HAIRCUT_OWNER_PASSWORD"),
  ownerName: readInput("owner-name", "HAIRCUT_OWNER_NAME").trim(),
  salonName: readInput("salon-name", "HAIRCUT_SALON_NAME").trim(),
  phone: readInput("phone", "HAIRCUT_SALON_PHONE", false).trim(),
};

if (!input.email || !input.password || !input.ownerName || !input.salonName) {
  throw new Error("Thieu email, mat khau, ten chu salon hoac ten salon.");
}

const app = initializeApp({
  apiKey: requiredEnv("VITE_FIREBASE_API_KEY"),
  authDomain: requiredEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: requiredEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: requiredEnv("VITE_FIREBASE_APP_ID"),
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
});

const auth = getAuth(app);
const db = getFirestore(app);

try {
  const credential = await signInOrCreateOwner(input.email, input.password);
  await updateProfile(credential.user, { displayName: input.ownerName });

  const userRef = doc(db, "users", credential.user.uid);
  const currentUser = await getDoc(userRef);

  if (currentUser.exists()) {
    const data = currentUser.data();
    console.log("Tai khoan da co ho so trong Firestore.");
    console.log(`UID: ${credential.user.uid}`);
    console.log(`Salon ID: ${data.salonId || ""}`);
    console.log(`Role: ${data.role || ""}`);
    process.exit(0);
  }

  const salonRef = doc(collection(db, "salons"));
  const mirrorRef = doc(collection(db, "mirrors"));
  const wheelRef = doc(db, "lucky_wheel", salonRef.id);
  const qrToken = randomUUID().replaceAll("-", "");
  const now = serverTimestamp();
  const batch = writeBatch(db);

  batch.set(salonRef, {
    name: input.salonName,
    address: null,
    phone: input.phone || null,
    ownerId: credential.user.uid,
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
    phone: input.phone || null,
    role: "owner",
    isActive: true,
    canRedeemRewards: true,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(wheelRef, {
    salonId: salonRef.id,
    requiredPoints: 5,
    deductPointsAfterSpin: true,
    slots: defaultWheelSlots,
    updatedAt: now,
  });

  batch.set(mirrorRef, {
    salonId: salonRef.id,
    name: "Guong 1",
    qrToken,
    qrUrl: buildQrUrl(salonRef.id, mirrorRef.id, qrToken),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await batch.commit();

  console.log("Da tao ho so chu salon thanh cong.");
  console.log(`UID: ${credential.user.uid}`);
  console.log(`Salon ID: ${salonRef.id}`);
  console.log(`Mirror ID: ${mirrorRef.id}`);
  console.log(`Owner URL: ${appUrl()}/owner`);
  console.log(`Staff URL: ${appUrl()}/staff`);
  console.log(`Customer QR URL: ${buildQrUrl(salonRef.id, mirrorRef.id, qrToken)}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password")) {
    throw new Error("Email hoac mat khau khong dung. Neu da tao user trong Console, hay dung dung mat khau cua user do.");
  }

  if (message.includes("Missing or insufficient permissions") || message.includes("permission-denied")) {
    throw new Error("Firestore Rules dang chan tao ho so owner. Can dung tab Dang ky tren web hoac cap nhat rules cho luong tao owner.");
  }

  throw error;
}

async function signInOrCreateOwner(email, password) {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (signInError) {
    const code = errorCode(signInError);

    if (code !== "auth/user-not-found" && code !== "auth/invalid-credential") {
      throw signInError;
    }
  }

  try {
    return await createUserWithEmailAndPassword(auth, email, password);
  } catch (createError) {
    if (errorCode(createError) === "auth/email-already-in-use") {
      return signInWithEmailAndPassword(auth, email, password);
    }

    throw createError;
  }
}

function buildQrUrl(salonId, mirrorId, qrToken) {
  const params = new URLSearchParams({ salonId, mirrorId, qrToken });
  return `${appUrl()}/?${params.toString()}`;
}

function appUrl() {
  return (process.env.VITE_PUBLIC_APP_URL || `https://${requiredEnv("VITE_FIREBASE_PROJECT_ID")}.web.app`).replace(/\/$/, "");
}

function readInput(argName, envName, required = true) {
  const argValue = readArg(argName);
  const value = argValue ?? process.env[envName] ?? "";

  if (required && !value) {
    throw new Error(`Thieu ${argName}. Chay voi --help de xem huong dan.`);
  }

  return value;
}

function readArg(name) {
  const prefix = `--${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));

  if (direct) {
    return direct.slice(prefix.length);
  }

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) {
    return process.argv[index + 1] || "";
  }

  return null;
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Thieu bien moi truong ${name} trong zalo-mini-app/.env`);
  }

  return value;
}

function loadDotEnv(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index < 0) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function errorCode(error) {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
}

function printHelp() {
  console.log(`
Tao ho so chu salon cho tai khoan Firebase Auth da co.

Cach dung:
  node tools/create-owner-profile.mjs --email owner@salon.com --password 123456 --owner-name "Anh Tan" --salon-name "HAIRCUT Studio"

Bien moi truong ho tro:
  HAIRCUT_OWNER_EMAIL
  HAIRCUT_OWNER_PASSWORD
  HAIRCUT_OWNER_NAME
  HAIRCUT_SALON_NAME
  HAIRCUT_SALON_PHONE
`);
}
