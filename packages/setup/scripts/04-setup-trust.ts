#!/usr/bin/env ts-node
/**
 * Step 4: Set up trust lines for IOU bridging
 *
 * For native XRP/XAH bridging, skip this step.
 * For IOU bridging (e.g., AXK), the Xahau door needs a trust line
 * to the token issuer on Xahau.
 *
 * The XRPL door does NOT need a trust line because it IS the issuer
 * of the wrapped token on XRPL.
 */

import "dotenv/config";
import { Client, Wallet } from "@transia/xrpl";
import { getChains, type NetworkEnv } from "@xbridge/config";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

async function main() {
  const currency = process.env.BRIDGE_CURRENCY || "XRP";
  const issuer = process.env.BRIDGE_ISSUER;

  if (currency === "XRP" && !issuer) {
    console.log("\n=== XBridge: Setup Trust Lines ===");
    console.log("Bridge is configured for native XRP/XAH — no trust lines needed.");
    console.log("Skip this step.");
    return;
  }

  if (!issuer) {
    console.error("BRIDGE_ISSUER must be set for IOU bridging");
    process.exit(1);
  }

  const chains = getChains(ENV);
  const xahauDoorSeed = process.env.XAHAU_DOOR_SEED;

  if (!xahauDoorSeed) {
    console.error("Missing XAHAU_DOOR_SEED in .env");
    process.exit(1);
  }

  const xahauDoor = Wallet.fromSeed(xahauDoorSeed);

  console.log(`\n=== XBridge: Setup Trust Lines (${ENV}) ===\n`);
  console.log(`Token: ${currency}`);
  console.log(`Issuer: ${issuer}`);
  console.log(`Xahau Door: ${xahauDoor.address}`);

  // Set trust line on Xahau door → token issuer
  console.log("\n--- Setting trust line on Xahau door ---");
  const xahauClient = new Client(chains.xahau.wss);
  await xahauClient.connect();

  try {
    const tx: Record<string, unknown> = {
      TransactionType: "TrustSet",
      Account: xahauDoor.address,
      LimitAmount: {
        currency,
        issuer,
        value: "999999999999", // large limit
      },
    };

    if (chains.xahau.networkId > 0) {
      tx.NetworkID = chains.xahau.networkId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await xahauClient.submitAndWait(tx as any, {
      wallet: xahauDoor,
      autofill: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result.result as any;
    console.log(`  Result: ${r.meta?.TransactionResult || "unknown"}`);
    console.log(`  Hash: ${r.hash}`);
  } catch (e) {
    console.error(`  Error: ${(e as Error).message}`);
  }

  await xahauClient.disconnect();

  console.log("\nNote: The XRPL door does NOT need a trust line — it IS the issuer on XRPL.");
  console.log("Next: Run 05-verify.ts to confirm the bridge is operational");
}

main().catch(console.error);
