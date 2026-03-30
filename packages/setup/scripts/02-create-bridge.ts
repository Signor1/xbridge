#!/usr/bin/env ts-node
/**
 * Step 2: Create bridge definition on both chains
 *
 * Submits XChainCreateBridge on Xahau (locking) and XRPL (issuing).
 * The bridge definition must be IDENTICAL on both chains.
 */

import "dotenv/config";
import { Client, Wallet } from "@transia/xrpl";
import { getChains, createBridgeDefinition, nativeIssue, type NetworkEnv } from "@xbridge/config";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

async function main() {
  const chains = getChains(ENV);

  const xahauDoorSeed = process.env.XAHAU_DOOR_SEED;
  const xrplDoorSeed = process.env.XRPL_DOOR_SEED;

  if (!xahauDoorSeed || !xrplDoorSeed) {
    console.error("Missing XAHAU_DOOR_SEED or XRPL_DOOR_SEED in .env");
    console.error("Run 01-fund-doors.ts first.");
    process.exit(1);
  }

  const xahauDoor = Wallet.fromSeed(xahauDoorSeed);
  const xrplDoor = Wallet.fromSeed(xrplDoorSeed);

  console.log(`\n=== XBridge: Create Bridge (${ENV}) ===\n`);
  console.log(`Xahau Door (locking): ${xahauDoor.address}`);
  console.log(`XRPL Door (issuing):  ${xrplDoor.address}`);

  // Build bridge definition — MUST be identical on both chains
  const bridge = createBridgeDefinition({
    lockingDoor: xahauDoor.address,
    lockingIssue: nativeIssue(), // Start with native XAH/XRP
    issuingDoor: xrplDoor.address,
    issuingIssue: nativeIssue(),
    signatureReward: "100",
    minAccountCreateAmount: "10000000",
  });

  console.log("\nBridge definition:", JSON.stringify(bridge, null, 2));

  // Submit on Xahau (locking chain)
  console.log("\n--- Submitting XChainCreateBridge on Xahau ---");
  const xahauClient = new Client(chains.xahau.wss);
  await xahauClient.connect();

  try {
    const xahauTx: Record<string, unknown> = {
      TransactionType: "XChainCreateBridge",
      Account: xahauDoor.address,
      XChainBridge: bridge,
      SignatureReward: bridge.SignatureReward,
      MinAccountCreateAmount: bridge.MinAccountCreateAmount,
    };

    // Xahau requires NetworkID
    if (chains.xahau.networkId > 0) {
      xahauTx.NetworkID = chains.xahau.networkId;
    }

    const xahauResult = await xahauClient.submitAndWait(xahauTx, {
      wallet: xahauDoor,
      autofill: true,
    });

    const xahauMeta = (xahauResult.result as Record<string, unknown>).meta as Record<string, unknown> | undefined;
    console.log(`  Result: ${xahauMeta?.TransactionResult || "unknown"}`);
    console.log(`  Hash: ${(xahauResult.result as Record<string, unknown>).hash}`);
  } catch (e) {
    console.error(`  Error: ${(e as Error).message}`);
  }

  await xahauClient.disconnect();

  // Submit on XRPL (issuing chain)
  console.log("\n--- Submitting XChainCreateBridge on XRPL ---");
  const xrplClient = new Client(chains.xrpl.wss);
  await xrplClient.connect();

  try {
    const xrplTx: Record<string, unknown> = {
      TransactionType: "XChainCreateBridge",
      Account: xrplDoor.address,
      XChainBridge: bridge,
      SignatureReward: bridge.SignatureReward,
      MinAccountCreateAmount: bridge.MinAccountCreateAmount,
    };

    const xrplResult = await xrplClient.submitAndWait(xrplTx, {
      wallet: xrplDoor,
      autofill: true,
    });

    const xrplMeta = (xrplResult.result as Record<string, unknown>).meta as Record<string, unknown> | undefined;
    console.log(`  Result: ${xrplMeta?.TransactionResult || "unknown"}`);
    console.log(`  Hash: ${(xrplResult.result as Record<string, unknown>).hash}`);
  } catch (e) {
    console.error(`  Error: ${(e as Error).message}`);
  }

  await xrplClient.disconnect();

  console.log("\n=== Bridge created on both chains ===");
  console.log("Next: Run 03-set-signer-list.ts to secure the door accounts");
}

main().catch(console.error);
