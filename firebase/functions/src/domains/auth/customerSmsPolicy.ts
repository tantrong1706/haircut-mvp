import { createHash } from "node:crypto";
import { isIP } from "node:net";

export function smsSendDecision(input: {
  phone: string;
  phoneCount: number;
  peerCount: number;
  dailyCount: number;
  phoneLimit: number;
  peerLimit: number;
  dailyLimit: number;
}): "allow" | "block" {
  if (!/^\+84[35789]\d{8}$/u.test(input.phone)) return "block";
  for (const [count, limit] of [
    [input.phoneCount, input.phoneLimit],
    [input.peerCount, input.peerLimit],
    [input.dailyCount, input.dailyLimit],
  ]) {
    if (
      !Number.isSafeInteger(count) ||
      count < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      count >= limit
    )
      return "block";
  }
  return "allow";
}

export function smsQuotaKeys(phone: string, peer: string, nowMs: number) {
  const canonical = peer.startsWith("::ffff:") && isIP(peer.slice(7)) === 4 ? peer.slice(7) : peer;
  const address = isIP(canonical) ? canonical : "unknown-peer";
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const hour = Math.floor(nowMs / 3_600_000);
  const day = Math.floor(nowMs / 86_400_000);
  return {
    phone: hash(`phone:${phone}:${hour}`),
    peer: hash(`peer:${address}:${hour}`),
    daily: hash(`sms-day:${day}`),
  };
}
