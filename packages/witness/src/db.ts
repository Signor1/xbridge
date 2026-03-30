/**
 * SQLite database for tracking processed commits (idempotency)
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.WITNESS_DB_PATH || path.join(process.cwd(), "witness.db");

let db: Database.Database;

export function initDb() {
  db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS processed_commits (
      tx_hash TEXT PRIMARY KEY,
      chain TEXT NOT NULL,
      processed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  console.log(`SQLite: ${DB_PATH}`);
}

export function isProcessed(txHash: string): boolean {
  const row = db.prepare("SELECT 1 FROM processed_commits WHERE tx_hash = ?").get(txHash);
  return !!row;
}

export function markProcessed(txHash: string, chain: string = "unknown") {
  db.prepare("INSERT OR IGNORE INTO processed_commits (tx_hash, chain) VALUES (?, ?)").run(
    txHash,
    chain,
  );
}
