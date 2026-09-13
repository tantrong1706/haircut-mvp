export interface ReplayStore {
  claim(keyId: string, nonce: string, expiresAtMs: number, nowMs?: number): boolean;
  close(): void;
}
