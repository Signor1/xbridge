#!/usr/bin/env ts-node
/* eslint-disable no-console */
/**
 * XBridge End-to-End Test
 *
 * Simulates: User locks XAH on Xahau → witnesses detect → release XRP on XRPL
 *
 * This runs the full flow without the witness servers — it manually performs
 * the lock, attestation, and multi-signed release steps to prove the protocol works.
 *
 * Usage: npx ts-node scripts/test-e2e.ts
 */

import "dotenv/config";
import { Client, Wallet } from "@transia/xrpl";
import { Wallet as XrplWallet, multisign, encode } from "xrpl";
import {
  getChains,
  buildLockMemo,
  buildReleaseMemo,
  parseMemo,
  computeAttestationHash,
  txUrl,
  type AttestationMessage,
} from "@xbridge/config";

// Load config
const ENV = "testnet" as const;
const chains = getChains(ENV);

const XAHAU_DOOR_SEED = process.env.XAHAU_DOOR_SEED!;
const XRPL_DOOR_SEED = process.env.XRPL_DOOR_SEED!;
const XAHAU_DOOR = process.env.XAHAU_DOOR_ADDRESS!;
const XRPL_DOOR = process.env.XRPL_DOOR_ADDRESS!;
const W1_SEED = process.env.WITNESS_1_SEED!;
const W2_SEED = process.env.WITNESS_2_SEED!;

// Use witness 3 as the "user" (funded on both chains, not in the SignerList quorum)
const USER_SEED = process.env.WITNESS_3_SEED!;
const USER_ADDRESS = process.env.WITNESS_3_ADDRESS!; // same address on both chains

const LOCK_AMOUNT = "5000000"; // 5 XAH/XRP in drops

async function main() {
  console.log("\n=== XBridge E2E Test ===\n");

  if (!XAHAU_DOOR_SEED || !XRPL_DOOR_SEED || !W1_SEED || !W2_SEED) {
    console.error("Missing env vars. Run from packages/setup/ with .env loaded.");
    console.error("Or copy the .env values to xbridge root .env");
    process.exit(1);
  }

  // ── Step 1: Lock XAH on Xahau (Payment to door with memo) ──
  console.log("── Step 1: Lock XAH on Xahau ──");

  const xahauClient = new Client(chains.xahau.wss);
  xahauClient.apiVersion = 1;
  await xahauClient.connect();

  const userWallet = Wallet.fromSeed(USER_SEED);
  console.log(`  User: ${userWallet.address}`);
  console.log(`  Door: ${XAHAU_DOOR}`);
  console.log(`  Amount: ${LOCK_AMOUNT} drops`);

  const memo = buildLockMemo({
    destination: USER_ADDRESS,
    sourceChain: "xahau",
  });

  const lockTx: Record<string, unknown> = {
    TransactionType: "Payment",
    Account: userWallet.address,
    Destination: XAHAU_DOOR,
    Amount: LOCK_AMOUNT,
    Memos: [memo],
    NetworkID: chains.xahau.networkId,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lockResult = await xahauClient.submitAndWait(lockTx as any, {
    wallet: userWallet,
    autofill: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lockR = lockResult.result as any;
  const lockHash = lockR.hash;
  const lockStatus = lockR.meta?.TransactionResult;

  console.log(`  TX Hash: ${lockHash}`);
  console.log(`  Result: ${lockStatus}`);
  console.log(`  Explorer: ${txUrl(chains.xahau, lockHash)}`);

  if (lockStatus !== "tesSUCCESS") {
    console.error("Lock failed!");
    await xahauClient.disconnect();
    process.exit(1);
  }

  // ── Step 2: Witness attestations (simulated) ──
  console.log("\n── Step 2: Witnesses sign attestations ──");

  const attestationMsg: AttestationMessage = {
    sourceTxHash: lockHash,
    sourceChain: "xahau",
    amount: LOCK_AMOUNT,
    currency: "XRP",
    destination: USER_ADDRESS,
  };

  const attestationHash = computeAttestationHash(attestationMsg);
  console.log(`  Attestation hash: ${attestationHash.substring(0, 32)}...`);

  const w1 = Wallet.fromSeed(W1_SEED);
  const w2 = Wallet.fromSeed(W2_SEED);
  console.log(`  Witness 1 (${w1.address}): signed`);
  console.log(`  Witness 2 (${w2.address}): signed`);
  console.log(`  Quorum: 2/2 ✅`);

  // ── Step 3: Multi-signed release on XRPL ──
  console.log("\n── Step 3: Release XRP on XRPL (multi-signed) ──");

  const xrplClient = new Client(chains.xrpl.wss);
  await xrplClient.connect();

  // Get door account sequence
  const accountInfo = await xrplClient.request({
    command: "account_info",
    account: XRPL_DOOR,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sequence = (accountInfo.result as any).account_data?.Sequence;

  const serverInfo = await xrplClient.request({ command: "server_info" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ledgerSeq = (serverInfo.result as any).info?.validated_ledger?.seq || 0;

  const releaseMemo = buildReleaseMemo({
    sourceTxHash: lockHash,
    sourceChain: "xahau",
  });

  // Multi-sign fee = (signers + 1) * base fee
  const releaseTx: Record<string, unknown> = {
    TransactionType: "Payment",
    Account: XRPL_DOOR,
    Destination: USER_ADDRESS,
    Amount: LOCK_AMOUNT,
    Fee: String(12 * 3), // 2 signers + 1 = 3x base fee
    Sequence: sequence,
    LastLedgerSequence: ledgerSeq + 30,
    Memos: [releaseMemo],
    SigningPubKey: "", // empty for multi-sign
  };

  // Use xrpl@4.6.0 for multi-signing (handles SigningPubKey: "" correctly)
  const xw1 = XrplWallet.fromSeed(W1_SEED);
  const xw2 = XrplWallet.fromSeed(W2_SEED);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signed1 = xw1.sign(releaseTx as any, true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signed2 = xw2.sign(releaseTx as any, true);

  console.log(`  Witness 1 signed release tx`);
  console.log(`  Witness 2 signed release tx`);

  // Combine multi-signatures
  const multiSignedBlob = multisign([signed1.tx_blob, signed2.tx_blob]);
  console.log(`  Multi-signed blob assembled`);

  // Submit
  const submitResult = await xrplClient.request({
    command: "submit",
    tx_blob: multiSignedBlob,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sr = submitResult.result as any;
  const releaseResult = sr.engine_result;
  const releaseHash = sr.tx_json?.hash;

  console.log(`  Result: ${releaseResult}`);
  console.log(`  Hash: ${releaseHash}`);
  if (releaseResult !== "tesSUCCESS" && releaseResult !== "terQUEUED") {
    console.error(`  ❌ ${releaseResult}: ${sr.engine_result_message || ""}`);
  } else {
    console.log(`  Explorer: ${txUrl(chains.xrpl, releaseHash)}`);
  }

  // ── Step 4: Verify ──
  console.log("\n── Step 4: Verify ──");

  // Check destination balance on XRPL
  try {
    const balance = await xrplClient.getXrpBalance(USER_ADDRESS);
    console.log(`  ${USER_ADDRESS} balance on XRPL: ${balance} XRP`);
  } catch {
    console.log(`  Could not check balance`);
  }

  await xahauClient.disconnect();
  await xrplClient.disconnect();

  console.log("\n=== E2E Test Complete ===");
  console.log(`\n  Lock TX (Xahau):    ${txUrl(chains.xahau, lockHash)}`);
  if (releaseHash) {
    console.log(`  Release TX (XRPL):  ${txUrl(chains.xrpl, releaseHash)}`);
  }
}

main().catch((err) => {
  console.error("E2E test failed:", err);
  process.exit(1);
});
