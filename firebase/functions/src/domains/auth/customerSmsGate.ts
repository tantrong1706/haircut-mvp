import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { smsQuotaKeys, smsSendDecision } from "./customerSmsPolicy";

export type SmsGateEvent = {
  smsType?: string;
  ipAddress?: string;
  additionalUserInfo?: { phoneNumber?: unknown };
};

// A configured Identity Platform beforeSmsSent hook is required. Client preflights cannot replace it.
export function createCustomerSmsGate(db: Firestore) {
  return async (event: SmsGateEvent): Promise<{ recaptchaActionOverride?: "BLOCK" }> => {
    if (process.env.CUSTOMER_SMS_GATE_ENABLED !== "true") return {};
    // Keep manager MFA out of this customer-only policy.
    if (event.smsType !== "SIGN_IN_OR_SIGN_UP") return {};
    const phone =
      typeof event.additionalUserInfo?.phoneNumber === "string"
        ? event.additionalUserInfo.phoneNumber
        : "";
    if (!/^\+84[35789]\d{8}$/u.test(phone)) return { recaptchaActionOverride: "BLOCK" };
    const nowMs = Date.now();
    const keys = smsQuotaKeys(phone, event.ipAddress || "", nowMs);
    const refs = Object.values(keys).map((key) => db.collection("_customer_sms_quotas").doc(key));
    try {
      return await db.runTransaction(async (tx) => {
        const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
        const decision = smsSendDecision({
          phone,
          phoneCount: Number(snapshots[0].data()?.count ?? 0),
          peerCount: Number(snapshots[1].data()?.count ?? 0),
          dailyCount: Number(snapshots[2].data()?.count ?? 0),
          phoneLimit: Number(process.env.CUSTOMER_SMS_PHONE_HOURLY_LIMIT ?? 3),
          peerLimit: Number(process.env.CUSTOMER_SMS_PEER_HOURLY_LIMIT ?? 20),
          dailyLimit: Number(process.env.CUSTOMER_SMS_DAILY_LIMIT ?? 100),
        });
        if (decision === "block") return { recaptchaActionOverride: "BLOCK" as const };
        for (const ref of refs)
          tx.set(
            ref,
            {
              count: FieldValue.increment(1),
              expiresAt: Timestamp.fromMillis(nowMs + 2 * 86_400_000),
            },
            { merge: true },
          );
        // Never return ALLOW: retain Firebase's own reCAPTCHA/risk decision.
        return {};
      });
    } catch {
      // No automatic fallback or retry that could send another billable message.
      return { recaptchaActionOverride: "BLOCK" };
    }
  };
}
