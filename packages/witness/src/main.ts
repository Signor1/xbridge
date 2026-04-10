/**
 * XBridge Witness Server
 *
 * Watches both chains for Payment locks to door accounts,
 * signs attestations, exchanges with peers, and submits
 * multi-signed release transactions when quorum is reached.
 */

import "dotenv/config";
import { listener } from "./listener";
import { startServer } from "./server";
import { initDb } from "./db";
import { getWitnessName, getEnv, getDoors, getQuorum, getPeerUrls } from "./config";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main() {
  const name = getWitnessName();
  const env = getEnv();
  const doors = getDoors();
  const peers = getPeerUrls();

  console.log(`\n=== XBridge Witness: ${name} (${env}) ===\n`);
  console.log(`Xahau door: ${doors.xahau}`);
  console.log(`XRPL door:  ${doors.xrpl}`);
  console.log(`Quorum:     ${getQuorum()}`);
  console.log(`Peers:      ${peers.length > 0 ? peers.join(", ") : "none (standalone)"}`);

  initDb();

  await startServer(PORT);
  console.log(`Server:     http://localhost:${PORT}/health`);

  await listener.start();

  console.log(`\n${name} running. Watching for lock events...\n`);

  const shutdown = async () => {
    console.log("\nShutting down...");
    await listener.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Witness failed:", err);
  process.exit(1);
});
