import { createHash, randomBytes } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { webPhonePrincipal, type CallableAuthContext } from "../../customerWebIdentity";
import {
  assertPasskeyEnrollment,
  assertPasskeyAccount,
  passkeyUserHandle,
} from "./customerPasskeyPolicy";

type Request = { auth?: CallableAuthContext; data: Record<string, unknown>; peer: string };
type Account = {
  uid: string;
  phoneNumber?: string;
  disabled: boolean;
  tokensValidAfterTime?: string;
};
type AuthService = {
  getUser(uid: string): Promise<Account>;
  createCustomToken(uid: string, claims: Record<string, unknown>): Promise<string>;
};
type Credential = {
  uid: string;
  phone: string;
  credentialId: string;
  publicKey: string;
  userHandle: string;
  counter: number;
  revision: number;
  active: boolean;
  createdAtMs: number;
};
const RP = "app.chhaircutsalon.cc";
const ORIGIN = `https://${RP}`;
const TTL_MS = 5 * 60_000;
const failure = () =>
  new HttpsError("unauthenticated", "Không xác minh được passkey. Vui lòng dùng OTP.");
const hash = (input: string) => createHash("sha256").update(input).digest("hex");
const id = (input: unknown) => {
  if (typeof input !== "string" || !/^[A-Za-z0-9_-]{16,1024}$/u.test(input)) throw failure();
  return input;
};

export function createCustomerPasskeys(db: Firestore, authService: AuthService) {
  const keys = db.collection("_customer_passkeys");
  const challenges = db.collection("_customer_auth_challenges");
  const inventories = db.collection("_customer_passkey_inventory");

  function enabled() {
    if (process.env.CUSTOMER_PASSKEYS_ENABLED !== "true")
      throw new HttpsError("failed-precondition", "Passkey chưa được bật. Vui lòng dùng OTP.");
  }
  async function liveAccount(uid: string, phone: string) {
    const [user, member, admin] = await Promise.all([
      authService.getUser(uid),
      db.doc(`users/${uid}`).get(),
      db.doc(`system_admin_access/${uid}`).get(),
    ]);
    const privileged =
      admin.exists || ["owner", "staff", "system_admin"].includes(String(member.data()?.role));
    assertPasskeyAccount(user, phone, privileged);
    if (user.uid !== uid) throw failure();
    return user;
  }
  function assertUnrevoked(authTime: unknown, user: Account) {
    const validAfter = Date.parse(user.tokensValidAfterTime || "1970-01-01T00:00:00Z");
    if (
      typeof authTime !== "number" ||
      !Number.isFinite(authTime) ||
      !Number.isFinite(validAfter) ||
      authTime * 1_000 < validAfter ||
      authTime * 1_000 > Date.now() + 30_000
    )
      throw failure();
  }

  // A signed marker alone is NOT sufficient: every use rechecks the live credential and account.
  async function resolvePrincipal(auth: CallableAuthContext) {
    // Rollout off disables NEW ceremonies, not already verified, still-active sessions.
    const firebase = auth?.token?.firebase as { sign_in_provider?: unknown } | undefined;
    if (firebase?.sign_in_provider === "phone") {
      const principal = webPhonePrincipal(auth);
      const user = await liveAccount(principal.uid, principal.phone);
      assertUnrevoked(auth?.token?.auth_time, user);
      return principal;
    }
    if (
      firebase?.sign_in_provider !== "custom" ||
      auth?.token?.customer_auth_method !== "passkey-v1" ||
      typeof auth.uid !== "string" ||
      !/^[a-f0-9]{64}$/u.test(String(auth.token.customer_passkey_id))
    )
      throw failure();
    const key = (await keys.doc(String(auth.token.customer_passkey_id)).get()).data() as
      Credential | undefined;
    if (!key?.active || key.uid !== auth.uid || key.phone !== auth.token.phone_number)
      throw failure();
    const user = await liveAccount(key.uid, key.phone);
    assertUnrevoked(auth.token.auth_time, user);
    // An old custom token must not become usable by exchanging it after revocation.
    assertUnrevoked(auth.token.customer_passkey_verified_at, user);
    return { uid: key.uid, phone: key.phone, phoneLast4: key.phone.slice(-4) };
  }

  async function limit(peer: string) {
    const now = Date.now();
    const ref = db
      .collection("_customer_passkey_quotas")
      .doc(hash(`${peer}:${Math.floor(now / 60_000)}`));
    await db.runTransaction(async (tx) => {
      const count = Number((await tx.get(ref)).data()?.count ?? 0);
      if (!Number.isSafeInteger(count) || count < 0 || count >= 30)
        throw new HttpsError("resource-exhausted", "Vui lòng chờ rồi thử lại.");
      tx.set(ref, { count: count + 1, expiresAt: Timestamp.fromMillis(now + 120_000) });
    });
  }
  async function saveChallenge(purpose: string, challenge: string, uid = "") {
    const challengeId = randomBytes(24).toString("base64url");
    await challenges
      .doc(challengeId)
      .create({ purpose, challenge, uid, expiresAt: Timestamp.fromMillis(Date.now() + TTL_MS) });
    return challengeId;
  }
  async function consume(input: unknown, purpose: string, uid = "") {
    const ref = challenges.doc(id(input));
    return db.runTransaction(async (tx) => {
      const value = (await tx.get(ref)).data();
      if (
        !value ||
        value.purpose !== purpose ||
        value.uid !== uid ||
        !(value.expiresAt instanceof Timestamp) ||
        value.expiresAt.toMillis() <= Date.now()
      )
        throw failure();
      tx.delete(ref);
      return String(value.challenge);
    });
  }
  function credentialResponse(value: unknown) {
    if (!value || typeof value !== "object" || JSON.stringify(value).length > 65_536)
      throw failure();
    const response = value as AuthenticationResponseJSON;
    id(response.id);
    if (response.type !== "public-key" || typeof response.response?.clientDataJSON !== "string")
      throw failure();
    const client = JSON.parse(
      Buffer.from(response.response.clientDataJSON, "base64url").toString("utf8"),
    );
    if (client.crossOrigin === true || client.topOrigin !== undefined) throw failure();
    return response;
  }
  async function beginRegistration(request: Request) {
    enabled();
    const principal = assertPasskeyEnrollment(request.auth, Date.now());
    const user = await liveAccount(principal.uid, principal.phone);
    assertUnrevoked(request.auth?.token?.auth_time, user);
    await limit(request.peer);
    const activeIds = ((await inventories.doc(principal.uid).get()).data()?.ids ?? []) as string[];
    if (activeIds.length >= 10)
      throw new HttpsError("resource-exhausted", "Tối đa 10 passkey. Hãy gỡ khóa không dùng.");
    const existing = activeIds.length
      ? await db.getAll(...activeIds.map((keyId) => keys.doc(keyId)))
      : [];
    const options = await generateRegistrationOptions({
      rpName: "CH Hair",
      rpID: RP,
      userID: new Uint8Array(Buffer.from(passkeyUserHandle(principal.uid), "base64url")),
      userName: `Khách ${principal.phoneLast4}`,
      attestationType: "none",
      timeout: 60_000,
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      excludeCredentials: existing.map((key) => ({ id: String(key.data()?.credentialId) })),
    });
    return {
      challengeId: await saveChallenge("register", options.challenge, principal.uid),
      options,
    };
  }
  async function finishRegistration(request: Request) {
    enabled();
    const principal = assertPasskeyEnrollment(request.auth, Date.now());
    const user = await liveAccount(principal.uid, principal.phone);
    assertUnrevoked(request.auth?.token?.auth_time, user);
    const challenge = await consume(request.data.challengeId, "register", principal.uid);
    const response = credentialResponse(request.data.response);
    const verification = await verifyRegistrationResponse({
      response: response as unknown as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo?.userVerified) throw failure();
    const credential = verification.registrationInfo.credential;
    if (credential.id !== response.id) throw failure();
    const keyId = hash(credential.id);
    const ref = keys.doc(keyId);
    const inventory = inventories.doc(principal.uid);
    await db.runTransaction(async (tx) => {
      const [stored, inventorySnap] = await Promise.all([tx.get(ref), tx.get(inventory)]);
      const activeIds = (inventorySnap.data()?.ids ?? []) as string[];
      if (stored.exists || activeIds.length >= 10) throw failure();
      tx.create(ref, {
        uid: principal.uid,
        phone: principal.phone,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        userHandle: passkeyUserHandle(principal.uid),
        counter: credential.counter,
        revision: 0,
        active: true,
        createdAtMs: Date.now(),
      } satisfies Credential);
      tx.set(inventory, { ids: [...activeIds, keyId] });
    });
    return { ok: true };
  }
  async function beginSignIn(request: Request) {
    enabled();
    await limit(request.peer);
    const options = await generateAuthenticationOptions({
      rpID: RP,
      userVerification: "required",
      timeout: 60_000,
    });
    return { challengeId: await saveChallenge("signin", options.challenge), options };
  }
  async function finishSignIn(request: Request) {
    enabled();
    await limit(request.peer);
    const challenge = await consume(request.data.challengeId, "signin");
    const response = credentialResponse(request.data.response);
    const ref = keys.doc(hash(response.id));
    const key = (await ref.get()).data() as Credential | undefined;
    if (
      !key?.active ||
      key.credentialId !== response.id ||
      response.response.userHandle !== key.userHandle
    )
      throw failure();
    await liveAccount(key.uid, key.phone);
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP,
      requireUserVerification: true,
      credential: {
        id: key.credentialId,
        publicKey: new Uint8Array(Buffer.from(key.publicKey, "base64url")),
        counter: key.counter,
      },
    });
    if (!result.verified || !result.authenticationInfo.userVerified) throw failure();
    const verifiedAt = Math.floor(Date.now() / 1_000);
    await db.runTransaction(async (tx) => {
      const latest = (await tx.get(ref)).data() as Credential | undefined;
      if (
        !latest?.active ||
        latest.uid !== key.uid ||
        latest.publicKey !== key.publicKey ||
        latest.revision !== key.revision
      )
        throw failure();
      tx.update(ref, { counter: result.authenticationInfo.newCounter, revision: key.revision + 1 });
    });
    const live = await liveAccount(key.uid, key.phone);
    assertUnrevoked(verifiedAt, live);
    const token = await authService.createCustomToken(key.uid, {
      customer_auth_method: "passkey-v1",
      customer_passkey_id: ref.id,
      customer_passkey_verified_at: verifiedAt,
    });
    return { token };
  }
  async function list(request: Request) {
    const principal = await resolvePrincipal(request.auth);
    const ids = ((await inventories.doc(principal.uid).get()).data()?.ids ?? []) as string[];
    const stored = ids.length ? await db.getAll(...ids.map((keyId) => keys.doc(keyId))) : [];
    return {
      keys: stored
        .filter((snap) => snap.data()?.active && snap.data()?.uid === principal.uid)
        .map((snap) => ({ id: snap.id, createdAtMs: Number(snap.data()?.createdAtMs) })),
    };
  }
  async function remove(request: Request) {
    const principal = await resolvePrincipal(request.auth);
    const ref = keys.doc(id(request.data.id));
    const inventory = inventories.doc(principal.uid);
    await db.runTransaction(async (tx) => {
      const [snap, inventorySnap] = await Promise.all([tx.get(ref), tx.get(inventory)]);
      if (snap.data()?.uid !== principal.uid || !snap.data()?.active) throw failure();
      tx.update(ref, { active: false });
      tx.set(inventory, {
        ids: ((inventorySnap.data()?.ids ?? []) as string[]).filter((keyId) => keyId !== ref.id),
      });
    });
    return { ok: true, requiresSignIn: request.auth?.token?.customer_passkey_id === ref.id };
  }
  return {
    beginRegistration,
    finishRegistration,
    beginSignIn,
    finishSignIn,
    list,
    remove,
    resolvePrincipal,
  };
}
