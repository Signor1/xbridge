#!/usr/bin/env ts-node
/**
 * Step 2: Create bridge definition on both chains
 *
 * Submits XChainCreateBridge on Xahau (locking) and XRPL (issuing).
 * The bridge definition must be IDENTICAL on both chains.
 *
 * Supports both native currency (XRP/XAH) and IOU bridging.
 * Set BRIDGE_CURRENCY and BRIDGE_ISSUER in .env for IOU mode.
 */

import "dotenv/config";
import { Client, Wallet } from "@transia/xrpl";
import {
  getChains,
  createBridgeDefinition,
  nativeIssue,
  iouIssue,
  type NetworkEnv,
} from "@xbridge/config";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

async function submitBridgeTx(
  client: Client,
  wallet: Wallet,
  bridge: ReturnType<typeof createBridgeDefinition>,
  networkId: number,
  chainName: string,
) {
  console.log(`\n--- Submitting XChainCreateBridge on ${chainName} ---`);

  const tx: Record<string, unknown> = {
    TransactionType: "XChainCreateBridge",
    Account: wallet.address,
    XChainBridge: bridge,
    SignatureReward: bridge.SignatureReward,
    MinAccountCreateAmount: bridge.MinAccountCreateAmount,
  };

  if (networkId > 0) {
    tx.NetworkID = networkId;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await client.submitAndWait(tx as any, {
      wallet,
      autofill: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (result.result as any).meta;
    const txResult = meta?.TransactionResult || "unknown";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = (result.result as any).hash;

    console.log(`  Result: ${txResult}`);
    console.log(`  Hash:   ${hash}`);

    if (txResult !== "tesSUCCESS") {
      console.error(`  ⚠ Transaction did not succeed: ${txResult}`);
    }

    return { success: txResult === "tesSUCCESS", hash };
  } catch (e) {
    console.error(`  Error: ${(e as Error).message}`);
    return { success: false, hash: null };
  }
}

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

  // Determine token type
  const currency = process.env.BRIDGE_CURRENCY || "XRP";
  const issuer = process.env.BRIDGE_ISSUER;
  const isNative = currency === "XRP" && !issuer;

  console.log(`\n=== XBridge: Create Bridge (${ENV}) ===\n`);
  console.log(`Xahau Door (locking): ${xahauDoor.address}`);
  console.log(`XRPL Door (issuing):  ${xrplDoor.address}`);
  console.log(`Token: ${isNative ? "Native (XRP/XAH)" : `${currency} (issuer: ${issuer})`}`);

  // Build bridge definition — MUST be identical on both chains
  const lockingIssue = isNative ? nativeIssue() : iouIssue(currency, issuer!);
  // On the issuing chain, the door account IS the issuer for wrapped tokens
  const issuingIssue = isNative ? nativeIssue() : iouIssue(currency, xrplDoor.address);

  const bridge = createBridgeDefinition({
    lockingDoor: xahauDoor.address,
    lockingIssue: lockingIssue,
    issuingDoor: xrplDoor.address,
    issuingIssue: issuingIssue,
    signatureReward: "100",
    minAccountCreateAmount: "10000000",
  });

  console.log("\nBridge definition:");
  console.log(JSON.stringify(bridge, null, 2));

  // Submit on Xahau (locking chain)
  const xahauClient = new Client(chains.xahau.wss);
  await xahauClient.connect();
  const xahauResult = await submitBridgeTx(
    xahauClient,
    xahauDoor,
    bridge,
    chains.xahau.networkId,
    "Xahau",
  );
  await xahauClient.disconnect();

  // Submit on XRPL (issuing chain)
  const xrplClient = new Client(chains.xrpl.wss);
  await xrplClient.connect();
  const xrplResult = await submitBridgeTx(
    xrplClient,
    xrplDoor,
    bridge,
    chains.xrpl.networkId,
    "XRPL",
  );
  await xrplClient.disconnect();

  // Summary
  console.log("\n=== Summary ===");
  console.log(`Xahau: ${xahauResult.success ? "✅" : "❌"} ${xahauResult.hash || "failed"}`);
  console.log(`XRPL:  ${xrplResult.success ? "✅" : "❌"} ${xrplResult.hash || "failed"}`);

  if (xahauResult.success && xrplResult.success) {
    console.log("\nBridge created on both chains.");
    console.log("Next: Run 03-set-signer-list.ts to secure the door accounts");
  } else {
    console.log("\n⚠ Bridge creation incomplete. Check errors above.");
  }
}

main().catch(console.error);
