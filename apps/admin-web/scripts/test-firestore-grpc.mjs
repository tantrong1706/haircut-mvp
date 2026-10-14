import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { initializeApp, deleteApp } from "firebase/app";
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  getDocsFromServer,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  terminate,
  where,
  writeBatch,
} from "firebase/firestore";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
assert.equal(emulatorHost, "127.0.0.1:8786", "Only the isolated loopback test emulator is allowed");
const projectId = "demo-haircut-grpc-compat";
const require = createRequire(import.meta.url);
const fromFirestore = createRequire(require.resolve("@firebase/firestore/package.json"));
assert.equal(fromFirestore("@grpc/grpc-js/package.json").version, "1.14.6");

test(
  "patched transport supports Firestore writes, reads, transactions, streaming and authorization",
  { timeout: 30000 },
  async () => {
    const app = initializeApp({ projectId, apiKey: "emulator-only" }, "grpc-compat");
    const anonymousApp = initializeApp({ projectId, apiKey: "emulator-only" }, "grpc-denied");
    const db = getFirestore(app);
    const deniedDb = getFirestore(anonymousApp);
    connectFirestoreEmulator(db, "127.0.0.1", 8786, {
      mockUserToken: { user_id: "grpc-compat-user" },
    });
    connectFirestoreEmulator(deniedDb, "127.0.0.1", 8786);
    let unsubscribe = () => undefined;
    let timeout;
    try {
      const target = doc(db, "compat", "transport");
      await setDoc(target, { points: 1, createdAt: serverTimestamp(), group: "compat" });
      assert.equal((await getDocFromServer(target)).data().points, 1);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(target);
        transaction.update(target, { points: snapshot.data().points + 1 });
      });
      const batch = writeBatch(db);
      batch.set(doc(db, "compat", "batch"), { group: "compat", points: 3 });
      await batch.commit();
      const selected = query(collection(db, "compat"), where("group", "==", "compat"));
      assert.equal((await getDocsFromServer(selected)).size, 2);
      await new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Firestore stream did not respond")), 10000);
        unsubscribe = onSnapshot(
          target,
          { includeMetadataChanges: true },
          (snapshot) => {
            if (!snapshot.metadata.fromCache && snapshot.data()?.points === 2) resolve();
          },
          reject,
        );
      });
      await assert.rejects(
        getDocFromServer(doc(deniedDb, "compat", "transport")),
        (error) => error.code === "permission-denied",
      );
    } finally {
      clearTimeout(timeout);
      unsubscribe();
      await Promise.all([terminate(db), terminate(deniedDb)]);
      await Promise.all([deleteApp(app), deleteApp(anonymousApp)]);
    }
  },
);

