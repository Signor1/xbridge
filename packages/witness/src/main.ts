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
import { getWitnessName, getEnv, getDoorAddresses, getBridgeDefinition } from "./config";

const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || "3000", 10);

async function main() {
  const name = getWitnessName();
  const env = getEnv();

  console.log(`\n=== XBridge Witness: ${name} (${env}) ===\n`);

  // Validate config early
  const doors = getDoorAddresses();
  const bridge = getBridgeDefinition();
  console.log(`Xahau door: ${doors.xahauDoor}`);
  console.log(`XRPL door:  ${doors.xrplDoor}`);
  console.log(`Token:      ${bridge.LockingChainIssue.currency}`);

  // Initialize SQLite for idempotency
  initDb();

  // Start health endpoint
  await startHealthServer(HEALTH_PORT);
  console.log(`Health:     http://localhost:${HEALTH_PORT}/health`);

  // Subscribe to both chains
  await listener.start();

  console.log(`\n${name} running. Watching for XChainCommit events...\n`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    await listener.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Witness failed to start:", err);
  process.exit(1);
});
