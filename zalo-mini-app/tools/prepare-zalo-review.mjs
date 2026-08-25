import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import QRCode from "qrcode";

const toolDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(toolDir, "..");
const repoDir = resolve(appDir, "..");
const statePath = resolve(appDir, ".zalo-review-credentials.json.local");
const reviewerFile = resolve(repoDir, "docs", "ZALO_REVIEW_ACCOUNTS.md.local");
let cachedAccessToken = "";

loadDotEnv(resolve(appDir, ".env.production"));
loadDotEnv(resolve(appDir, ".env.production.local"), true);

const projectId = requiredEnv("VITE_FIREBASE_PROJECT_ID");
const region = process.env.VITE_FIREBASE_REGION || "asia-southeast1";
const supportPhone = process.env.VITE_SUPPORT_PHONE || "";
const state = readOrCreateState();

const app = initializeApp({
  apiKey: requiredEnv("VITE_FIREBASE_API_KEY"),
  authDomain: requiredEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: requiredEnv("VITE_FIREBASE_APP_ID"),
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
});

const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, region);

await upsertAuthUser({
  email: state.owner.email,
  password: state.owner.password,
  displayName: "Tấn Trọng",
  emailVerified: true,
});

const ownerCredential = await signInWithEmailAndPassword(
  auth,
  state.owner.email,
  state.owner.password,
);

let ownerProfile = await readProfile(ownerCredential.user.uid);
let salonId = ownerProfile?.salonId || "";

if (!salonId) {
  const created = await callFunction("createSalon", {
    name: "CH Haircut Salon - Xét duyệt Zalo",
    ownerName: "Tấn Trọng",
    phone: supportPhone,
  });
  salonId = String(created.salonId || "");
  ownerProfile = await readProfile(ownerCredential.user.uid);
}

if (!salonId || ownerProfile?.role !== "owner") {
  throw new Error("Không hoàn tất được hồ sơ chủ salon thử nghiệm.");
}

let branchResult = await callFunction("listBranches", { salonId });
let branches = Array.isArray(branchResult.branches) ? branchResult.branches : [];

if (branches.length < 2) {
  await callFunction("createBranch", {
    salonId,
    name: "Chi nhánh Trung tâm",
    address: "123 Nguyễn Huệ, Quận 1, TP.HCM",
    phone: supportPhone,
  });
  branchResult = await callFunction("listBranches", { salonId });
  branches = Array.isArray(branchResult.branches) ? branchResult.branches : [];
}

if (branches.length < 2) {
  throw new Error("Salon thử nghiệm phải có ít nhất hai chi nhánh.");
}

const activeBranches = branches.filter((branch) => branch.isActive !== false);
const staffBranch = activeBranches[0];
if (!staffBranch?.id) {
  throw new Error("Không tìm thấy chi nhánh hoạt động để phân công nhân viên.");
}

let staffResult = await callFunction("listStaffProfiles", { salonId });
let staffProfiles = Array.isArray(staffResult.staff) ? staffResult.staff : [];
let staffProfile = staffProfiles.find(
  (profile) => String(profile.email || "").toLowerCase() === state.staff.email,
);

if (!staffProfile) {
  await callFunction("createStaffProfile", {
    salonId,
    email: state.staff.email,
    name: "Nhân viên xét duyệt",
    phone: supportPhone,
    canRedeemRewards: true,
    branchIds: [staffBranch.id],
  });
  staffResult = await callFunction("listStaffProfiles", { salonId });
  staffProfiles = Array.isArray(staffResult.staff) ? staffResult.staff : [];
  staffProfile = staffProfiles.find(
    (profile) => String(profile.email || "").toLowerCase() === state.staff.email,
  );
}

if (!staffProfile?.uid) {
  throw new Error("Không hoàn tất được hồ sơ nhân viên thử nghiệm.");
}

await upsertAuthUser({
  uid: staffProfile.uid,
  email: state.staff.email,
  password: state.staff.password,
  displayName: "Nhân viên xét duyệt",
  emailVerified: true,
});

await signOut(auth);
const staffCredential = await signInWithEmailAndPassword(
  auth,
  state.staff.email,
  state.staff.password,
);
const verifiedStaffProfile = await readProfile(staffCredential.user.uid);
const staffBranchesResult = await callFunction("listBranches", { salonId });
const visibleStaffBranches = Array.isArray(staffBranchesResult.branches)
  ? staffBranchesResult.branches
  : [];

if (
  verifiedStaffProfile?.role !== "staff" ||
  !verifiedStaffProfile.isActive ||
  visibleStaffBranches.length !== 1 ||
  visibleStaffBranches[0]?.id !== staffBranch.id
) {
  throw new Error("Phân quyền chi nhánh của tài khoản nhân viên chưa đúng.");
}

await signOut(auth);

await seedReviewBusinessData({
  salonId,
  branch: staffBranch,
  staffUid: staffProfile.uid,
  staffName: staffProfile.name || "Nhân viên xét duyệt",
  ownerUid: ownerCredential.user.uid,
});

const qrFiles = [];
if (branchResult.salonQrUrl) {
  const salonQrPath = resolve(appDir, "qr-salon-review-dev.png");
  await writeQr(salonQrPath, branchResult.salonQrUrl);
  qrFiles.push(salonQrPath);
}

for (const [index, branch] of activeBranches.entries()) {
  if (!branch.qrUrl) {
    continue;
  }
  const branchQrPath = resolve(appDir, `qr-branch-${index + 1}-review-dev.png`);
  await writeQr(branchQrPath, branch.qrUrl);
  qrFiles.push(branchQrPath);
}

state.version = 2;
state.salonId = salonId;
state.owner.uid = ownerCredential.user.uid;
state.staff.uid = staffProfile.uid;
state.staff.branchId = staffBranch.id;
state.branches = activeBranches.map((branch) => ({
  id: branch.id,
  name: branch.name,
  address: branch.address || "",
}));
delete state.salonQrUrl;
state.updatedAt = new Date().toISOString();
writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
writeReviewerFile({ state, branches: activeBranches, staffBranch, qrFiles });

console.log("ZALO_REVIEW_TEST_DATA_READY");
console.log(`Owner: ${state.owner.email} (verified)`);
console.log(`Staff: ${state.staff.email} (verified, 1 branch)`);
console.log(`Branches: ${activeBranches.length}`);
console.log(`Credentials: ${reviewerFile}`);
console.log(`QR files: ${qrFiles.length}`);

async function callFunction(name, data) {
  const callable = httpsCallable(functions, name);
  const result = await callable(data);
  return result.data ?? {};
}

async function readProfile(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) {
    return null;
  }
  const data = snapshot.data();
  return {
    uid,
    salonId: String(data.salonId || ""),
    role: String(data.role || ""),
    isActive: data.isActive === true,
  };
}

async function upsertAuthUser(input) {
  const existing = input.uid
    ? await lookupAuthUser({ localId: [input.uid] })
    : await lookupAuthUser({ email: [input.email] });

  if (!existing) {
    await adminAuthRequest("/accounts", {
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      emailVerified: input.emailVerified,
      disableUser: false,
    });
    return;
  }

  await adminAuthRequest("/accounts:update", {
    localId: existing.localId,
    email: input.email,
    password: input.password,
    displayName: input.displayName,
    emailVerified: input.emailVerified,
    disableUser: false,
  });
}

async function lookupAuthUser(selector) {
  try {
    const result = await adminAuthRequest("/accounts:lookup", selector);
    return Array.isArray(result.users) ? (result.users[0] ?? null) : null;
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_USER_NOT_FOUND") {
      return null;
    }
    throw error;
  }
}

async function adminAuthRequest(path, body) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gcloudAccessToken()}`,
        "Content-Type": "application/json",
        "x-goog-user-project": projectId,
      },
      body: JSON.stringify(body),
    },
  );
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const code = String(result?.error?.message || "");
    if (code.includes("USER_NOT_FOUND")) {
      throw new Error("AUTH_USER_NOT_FOUND");
    }
    throw new Error(`Firebase Auth Admin trả về HTTP ${response.status}.`);
  }
  return result;
}

function gcloudAccessToken() {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  const powershell = `${process.env.SystemRoot || "C:\\Windows"}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
  const gcloud = resolve(
    process.env.LOCALAPPDATA || "",
    "Google",
    "Cloud SDK",
    "google-cloud-sdk",
    "bin",
    "gcloud.ps1",
  );
  const command = `& '${gcloud.replaceAll("'", "''")}' auth print-access-token --quiet`;
  cachedAccessToken = execFileSync(
    powershell,
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { encoding: "utf8", windowsHide: true },
  ).trim();

  if (!cachedAccessToken) {
    throw new Error("Google Cloud CLI chưa đăng nhập.");
  }
  return cachedAccessToken;
}

async function seedReviewBusinessData(input) {
  const now = Date.now();
  const expiresAt = new Date(now + 10 * 60 * 60 * 1000);
  const branch = {
    id: String(input.branch.id),
    name: String(input.branch.name || "Chi nhánh Trung tâm"),
    address: String(input.branch.address || "123 Nguyễn Huệ, Quận 1, TP.HCM"),
  };
  const customers = [
    {
      id: "zalo-review-customer-waiting",
      name: "Anh Hoàng",
      phone: "0900001001",
      points: 4,
      allowPhoto: false,
      activeSessionId: "zalo-review-session-waiting",
    },
    {
      id: "zalo-review-customer-serving",
      name: "Linh Chi",
      phone: "0900001002",
      points: 7,
      allowPhoto: true,
      activeSessionId: "zalo-review-session-serving",
    },
    {
      id: "zalo-review-customer-pending",
      name: "Minh Anh",
      phone: "0900001003",
      points: 9,
      allowPhoto: false,
      activeSessionId: "zalo-review-session-pending",
    },
    {
      id: "zalo-review-customer-completed",
      name: "Quang Huy",
      phone: "0900001004",
      points: 12,
      allowPhoto: true,
      activeSessionId: "",
    },
  ];

  await Promise.all(
    customers.map((customer, index) =>
      writeFirestoreDocument("customers", customer.id, {
        salonId: input.salonId,
        zaloUserId: `zalo-review-${index + 1}`,
        source: "zalo_review_seed",
        name: customer.name,
        nameSearch: customer.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase(),
        phone: customer.phone,
        phoneLast4: customer.phone.slice(-4),
        points: customer.points,
        allowPhoto: customer.allowPhoto,
        activeSessionId: customer.activeSessionId || null,
        lastBranchId: branch.id,
        lastVisitAt: index === 3 ? new Date(now - 24 * 60 * 60 * 1000) : null,
        createdAt: new Date(now - (index + 1) * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now),
      }),
    ),
  );

  const sessionDefinitions = [
    {
      id: "zalo-review-session-waiting",
      customer: customers[0],
      status: "waiting",
      assignedStaffId: "",
      assignedStaffName: "",
      createdAt: new Date(now - 60 * 1000),
    },
    {
      id: "zalo-review-session-serving",
      customer: customers[1],
      status: "serving",
      assignedStaffId: input.staffUid,
      assignedStaffName: input.staffName,
      createdAt: new Date(now - 3 * 60 * 1000),
    },
    {
      id: "zalo-review-session-pending",
      customer: customers[2],
      status: "pending_approval",
      assignedStaffId: input.staffUid,
      assignedStaffName: input.staffName,
      createdAt: new Date(now - 6 * 60 * 1000),
    },
    {
      id: "zalo-review-session-completed",
      customer: customers[3],
      status: "completed",
      assignedStaffId: input.staffUid,
      assignedStaffName: input.staffName,
      createdAt: new Date(now - 30 * 60 * 1000),
    },
  ];

  await Promise.all(
    sessionDefinitions.map((session) =>
      writeFirestoreDocument("chair_sessions", session.id, {
        salonId: input.salonId,
        branchId: branch.id,
        branchName: branch.name,
        branchAddress: branch.address,
        qrType: "branch",
        legacyMirrorId: null,
        customerId: session.customer.id,
        customerSummary: {
          name: session.customer.name,
          phoneLast4: session.customer.phone.slice(-4),
          points: session.customer.points,
          allowPhoto: session.customer.allowPhoto,
        },
        status: session.status,
        isOpen: session.status !== "completed",
        assignedStaffId: session.assignedStaffId || null,
        assignedStaffName: session.assignedStaffName || null,
        claimedAt: session.assignedStaffId ? session.createdAt : null,
        expiresAt,
        createdAt: session.createdAt,
        updatedAt: new Date(now),
      }),
    ),
  );

  await Promise.all([
    writeFirestoreDocument("point_requests", "zalo-review-session-pending", {
      salonId: input.salonId,
      branchId: branch.id,
      branchName: branch.name,
      sessionId: "zalo-review-session-pending",
      customerId: customers[2].id,
      staffId: input.staffUid,
      staffName: input.staffName,
      note: "Fade thấp, tỉa gọn hai bên và giữ độ dài phần mái.",
      photoUrls: [],
      pointsRequested: 1,
      pointsAdded: 1,
      customerSummary: {
        name: customers[2].name,
        phoneLast4: customers[2].phone.slice(-4),
        points: customers[2].points,
        allowPhoto: customers[2].allowPhoto,
      },
      status: "pending",
      createdAt: new Date(now - 5 * 60 * 1000),
      updatedAt: new Date(now),
    }),
    writeFirestoreDocument("point_requests", "zalo-review-session-completed", {
      salonId: input.salonId,
      branchId: branch.id,
      branchName: branch.name,
      sessionId: "zalo-review-session-completed",
      customerId: customers[3].id,
      staffId: input.staffUid,
      staffName: input.staffName,
      note: "Giữ form cũ, tỉa mái và vệ sinh đường viền.",
      photoUrls: [],
      pointsRequested: 1,
      pointsAdded: 1,
      status: "approved",
      approvedBy: input.ownerUid,
      approvedAt: new Date(now - 20 * 60 * 1000),
      createdAt: new Date(now - 25 * 60 * 1000),
      updatedAt: new Date(now),
    }),
    writeFirestoreDocument("haircut_records", "zalo-review-session-completed", {
      salonId: input.salonId,
      branchId: branch.id,
      branchName: branch.name,
      sessionId: "zalo-review-session-completed",
      customerId: customers[3].id,
      staffId: input.staffUid,
      staffName: input.staffName,
      note: "Giữ form cũ, tỉa mái và vệ sinh đường viền.",
      photoUrls: [],
      pointsAdded: 1,
      createdAt: new Date(now - 20 * 60 * 1000),
    }),
    writeFirestoreDocument("reward_history", "zalo-review-reward-unused", {
      salonId: input.salonId,
      branchId: branch.id,
      customerId: customers[3].id,
      rewardName: "Gội đầu miễn phí",
      rewardCode: "HC-REVIEW-CHUADUNG",
      isWinning: true,
      status: "unused",
      pointsUsed: 5,
      expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now - 15 * 60 * 1000),
    }),
    writeFirestoreDocument("reward_history", "zalo-review-reward-used", {
      salonId: input.salonId,
      branchId: branch.id,
      customerId: customers[3].id,
      rewardName: "Giảm 10% dịch vụ",
      rewardCode: "HC-REVIEW-DADUNG",
      isWinning: true,
      status: "used",
      pointsUsed: 5,
      usedBy: input.staffUid,
      usedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
    }),
  ]);

  console.log("Review business data: 4 customers, 4 sessions, 2 point requests, 2 rewards");
}

async function writeFirestoreDocument(collectionName, documentId, data) {
  const documentPath = `${encodeURIComponent(collectionName)}/${encodeURIComponent(documentId)}`;
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${documentPath}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${gcloudAccessToken()}`,
        "Content-Type": "application/json",
        "x-goog-user-project": projectId,
      },
      body: JSON.stringify({ fields: firestoreFields(data) }),
    },
  );

  if (!response.ok) {
    throw new Error(`Firestore Admin trả về HTTP ${response.status}.`);
  }
}

function firestoreFields(value) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([key, fieldValue]) => [key, firestoreValue(fieldValue)]),
  );
}

function firestoreValue(value) {
  if (value === null) {
    return { nullValue: null };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(firestoreValue) } };
  }
  if (typeof value === "boolean") {
    return { booleanValue: value };
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: firestoreFields(value) } };
  }
  return { stringValue: String(value) };
}

async function writeQr(path, value) {
  await QRCode.toFile(path, value, {
    width: 1200,
    margin: 4,
    errorCorrectionLevel: "H",
    color: { dark: "#10251f", light: "#ffffff" },
  });
}

function writeReviewerFile(input) {
  const branchLines = input.branches
    .map((branch) => `- ${branch.name}: ${branch.address || "Chưa có địa chỉ"}`)
    .join("\n");
  const qrLines = input.qrFiles.map((path) => `- \`${path}\``).join("\n");
  const content = `# Tài khoản thử nghiệm Zalo - CH Haircut Salon

File local này chứa mật khẩu thử nghiệm. Không commit hoặc gửi công khai.

## Chủ salon

- Trang: https://app.chhaircutsalon.cc/owner
- Email: ${input.state.owner.email}
- Mật khẩu: ${input.state.owner.password}
- Email đã xác minh: Có

## Nhân viên

- Trang: https://app.chhaircutsalon.cc/staff
- Email: ${input.state.staff.email}
- Mật khẩu: ${input.state.staff.password}
- Chi nhánh được phân công: ${input.staffBranch.name}

## Dữ liệu thử nghiệm

${branchLines}

## QR thử nghiệm

${qrLines}
`;
  writeFileSync(reviewerFile, content, { encoding: "utf8", mode: 0o600 });
}

function readOrCreateState() {
  if (existsSync(statePath)) {
    return JSON.parse(readFileSync(statePath, "utf8"));
  }

  return {
    version: 1,
    owner: {
      email:
        process.env.HAIRCUT_REVIEW_OWNER_EMAIL || "tantrong1706+haircut.review.owner@gmail.com",
      password: strongPassword(),
    },
    staff: {
      email:
        process.env.HAIRCUT_REVIEW_STAFF_EMAIL || "tantrong1706+haircut.review.staff@gmail.com",
      password: strongPassword(),
    },
  };
}

function strongPassword() {
  return `Review!${randomBytes(18).toString("base64url")}Aa1`;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}.`);
  }
  return value;
}

function loadDotEnv(path, override = false) {
  if (!existsSync(path)) {
    return;
  }
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator < 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && (override || process.env[key] === undefined)) {
      process.env[key] = value;
    }
  }
}
