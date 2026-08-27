import { DatabaseSync } from "node:sqlite";
import type { ReplayStore } from "./replayStore.js";

export class SqliteReplayStore implements ReplayStore {
  private readonly database: DatabaseSync;
  private closed = false;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec(
      "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;",
    );
    this.database.exec(
      "CREATE TABLE IF NOT EXISTS replay_nonces (" +
        "key_id TEXT NOT NULL, nonce TEXT NOT NULL, expires_at_ms INTEGER NOT NULL, " +
        "PRIMARY KEY (key_id, nonce)) WITHOUT ROWID;",
    );
    this.database.exec(
      "CREATE INDEX IF NOT EXISTS replay_nonces_expiry_idx ON replay_nonces(expires_at_ms);",
    );
  }

  claim(keyId: string, nonce: string, expiresAtMs: number, nowMs = Date.now()) {
    if (this.closed) throw new Error("Replay store is closed");
    this.database.exec("BEGIN IMMEDIATE;");
    try {
      this.database.prepare("DELETE FROM replay_nonces WHERE expires_at_ms <= ?").run(nowMs);
      const result = this.database
        .prepare(
          "INSERT OR IGNORE INTO replay_nonces(key_id, nonce, expires_at_ms) VALUES (?, ?, ?)",
        )
        .run(keyId, nonce, expiresAtMs);
      this.database.exec("COMMIT;");
      return result.changes === 1;
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.database.close();
  }
}
