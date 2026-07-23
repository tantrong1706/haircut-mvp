import { readFile } from "node:fs/promises";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldPath, getFirestore } from "firebase-admin/firestore";

const COLLECTIONS = JSON.parse(
  await readFile(new URL("./tenant-collections.json", import.meta.url), "utf8"),
);
const args = parseArgs(process.argv.slice(2));
const projectId = args.project;

if (!projectId) {
  throw new Error("Bắt buộc truyền --project <firebase-project-id>.");
}
if (args.apply && args.confirmProject !== projectId) {
  throw new Error("Chế độ ghi yêu cầu --confirm-project trùng chính xác --project.");
}
if (args.apply && !args.mapping) {
  throw new Error("Chế độ ghi bắt buộc có --mapping <file-json> đã được kiểm tra thủ công.");
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const missingByCollection = {};

for (const collectionName of COLLECTIONS) {
  missingByCollection[collectionName] = await countMissingSalonIds(collectionName);
}

console.table(
  COLLECTIONS.map((collectionName) => ({
    collection: collectionName,
    missingSalonId: missingByCollection[collectionName],
  })),
);

if (!args.mapping) {
  console.log("DRY-RUN: chưa có mapping nên không document nào được thay đổi.");
  process.exit(0);
}

const mapping = JSON.parse(await readFile(args.mapping, "utf8"));
const entries = Array.isArray(mapping.entries) ? mapping.entries : [];
const summary = { ready: 0, unchanged: 0, missingDocument: 0, invalid: 0, updated: 0 };
const writes = [];

for (const entry of entries) {
  if (!isValidEntry(entry)) {
    summary.invalid += 1;
    continue;
  }
  const ref = db.collection(entry.collection).doc(entry.documentId);
  const snap = await ref.get();
  if (!snap.exists) {
    summary.missingDocument += 1;
    continue;
  }
  const currentSalonId = String(snap.data()?.salonId || "").trim();
  if (currentSalonId && currentSalonId !== entry.salonId) {
    summary.invalid += 1;
    continue;
  }
  const patch = {};
  if (!currentSalonId) patch.salonId = entry.salonId;
  if (!snap.data()?.branchId && entry.branchId) patch.branchId = entry.branchId;
  if (Object.keys(patch).length === 0) {
    summary.unchanged += 1;
    continue;
  }
  const validReferences = await referencesExist(entry.salonId, entry.branchId);
  if (!validReferences) {
    summary.invalid += 1;
    continue;
  }
  summary.ready += 1;
  writes.push({ ref, patch });
}

if (args.apply) {
  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = db.batch();
    writes.slice(offset, offset + 400).forEach(({ ref, patch }) => {
      batch.set(ref, patch, { merge: true });
    });
    await batch.commit();
    summary.updated += Math.min(400, writes.length - offset);
  }
}

console.table(summary);
console.log(
  args.apply
    ? "Đã áp dụng mapping. Chạy lại dry-run để xác minh; thao tác này là idempotent."
    : "DRY-RUN: mapping hợp lệ đã được kiểm tra nhưng chưa có document nào được thay đổi.",
);

async function countMissingSalonIds(collectionName) {
  let count = 0;
  let cursor = null;
  do {
    let query = db.collection(collectionName).orderBy(FieldPath.documentId()).limit(250);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    page.docs.forEach((doc) => {
      if (typeof doc.data().salonId !== "string" || !doc.data().salonId.trim()) count += 1;
    });
    cursor = page.size === 250 ? page.docs.at(-1) : null;
  } while (cursor);
  return count;
}

async function referencesExist(salonId, branchId) {
  const salonSnap = await db.collection("salons").doc(salonId).get();
  if (!salonSnap.exists) return false;
  if (!branchId) return true;
  const branchSnap = await db.collection("branches").doc(branchId).get();
  return branchSnap.exists && branchSnap.data()?.salonId === salonId;
}

function isValidEntry(entry) {
  return Boolean(
    entry &&
      COLLECTIONS.includes(entry.collection) &&
      typeof entry.documentId === "string" &&
      entry.documentId.trim() &&
      typeof entry.salonId === "string" &&
      entry.salonId.trim() &&
      (entry.branchId === undefined || typeof entry.branchId === "string"),
  );
}

function parseArgs(values) {
  const parsed = { apply: false, project: "", confirmProject: "", mapping: "" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--apply") parsed.apply = true;
    else if (value === "--project") parsed.project = values[++index] || "";
    else if (value === "--confirm-project") parsed.confirmProject = values[++index] || "";
    else if (value === "--mapping") parsed.mapping = values[++index] || "";
  }
  return parsed;
}
