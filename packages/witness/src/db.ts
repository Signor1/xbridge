/**
 * SQLite database for tracking processed locks and collected attestations
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.WITNESS_DB_PATH || path.join(process.cwd(), "witness.db");

let db: Database.Database;

export function initDb() {
  db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS processed_locks (
      tx_hash TEXT PRIMARY KEY,
      source_chain TEXT NOT NULL,
      amount TEXT NOT NULL,
      destination TEXT NOT NULL,
      released INTEGER DEFAULT 0,
      release_tx_hash TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attestations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_tx_hash TEXT NOT NULL,
      witness_account TEXT NOT NULL,
      witness_public_key TEXT NOT NULL,
      signature TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(source_tx_hash, witness_account)
    );
  `);
  console.log(`SQLite: ${DB_PATH}`);
}

export function isLockProcessed(txHash: string): boolean {
  return !!db.prepare("SELECT 1 FROM processed_locks WHERE tx_hash = ?").get(txHash);
}

export function isLockReleased(txHash: string): boolean {
  const row = db.prepare("SELECT released FROM processed_locks WHERE tx_hash = ?").get(txHash) as
    | { released: number }
    | undefined;
  return row?.released === 1;
}

export function saveLock(txHash: string, sourceChain: string, amount: string, destination: string) {
  db.prepare(
    "INSERT OR IGNORE INTO processed_locks (tx_hash, source_chain, amount, destination) VALUES (?, ?, ?, ?)",
  ).run(txHash, sourceChain, amount, destination);
}

export function markReleased(sourceTxHash: string, releaseTxHash: string) {
  db.prepare("UPDATE processed_locks SET released = 1, release_tx_hash = ? WHERE tx_hash = ?").run(
    releaseTxHash,
    sourceTxHash,
  );
}

export function saveAttestation(
  sourceTxHash: string,
  witnessAccount: string,
  witnessPublicKey: string,
  signature: string,
) {
  db.prepare(
    "INSERT OR IGNORE INTO attestations (source_tx_hash, witness_account, witness_public_key, signature) VALUES (?, ?, ?, ?)",
  ).run(sourceTxHash, witnessAccount, witnessPublicKey, signature);
}

export function getAttestations(
  sourceTxHash: string,
): { witness_account: string; witness_public_key: string; signature: string }[] {
  return db
    .prepare("SELECT witness_account, witness_public_key, signature FROM attestations WHERE source_tx_hash = ?")
    .all(sourceTxHash) as { witness_account: string; witness_public_key: string; signature: string }[];
}

export function getAttestationCount(sourceTxHash: string): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM attestations WHERE source_tx_hash = ?")
    .get(sourceTxHash) as { count: number };
  return row.count;
}
