/**
 * XBridge Witness Server
 *
 * Watches both Xahau and XRPL for XChainCommit transactions
 * and submits XChainAddClaimAttestation on the destination chain.
 */

import "dotenv/config";
import { listener } from "./listener";
import { startHealthServer } from "./health";
import { initDb } from "./db";

const WITNESS_NAME = process.env.WITNESS_NAME || "witness-1";
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || "3000", 10);

async function main() {
  console.log(`\n=== XBridge Witness: ${WITNESS_NAME} ===\n`);

  // Initialize SQLite for processed commits tracking
  initDb();

  // Start health check endpoint
  await startHealthServer(HEALTH_PORT);
  console.log(`Health: http://localhost:${HEALTH_PORT}/health`);

  // Start listening on both chains
  await listener.start();

  console.log("\nWitness running. Watching for XChainCommit events...");

  // Keep alive
  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await listener.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Witness failed to start:", err);
  process.exit(1);
});
