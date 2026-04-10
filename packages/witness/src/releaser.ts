/**
 * Releaser — when quorum attestations are collected, build and submit
 * a multi-signed Payment from the door account to the recipient.
 *
 * Uses xrpl@4.6.0 for multi-sign (handles SigningPubKey:"" correctly).
 * Uses @transia/xrpl Client for WebSocket (already established in listener).
 */

import { Wallet as XrplWallet, multisign } from "xrpl";
import { buildReleaseMemo, txUrl, type LockEvent } from "@xbridge/config";
import { getAttestationCount, isLockReleased, markReleased } from "./db";
import { getQuorum, getDoorAddress, getChainConfig, getWitnessName } from "./config";
import { listener } from "./listener";

/**
 * Check if we have enough attestations and submit the release
 */
// Track which locks we're currently releasing to prevent double-submit
const releasingSet = new Set<string>();

export async function tryRelease(lock: LockEvent) {
  const quorum = getQuorum();
  const attCount = getAttestationCount(lock.txHash);

  if (attCount < quorum) {
    console.log(`  Attestations: ${attCount}/${quorum} — waiting`);
    return;
  }

  if (isLockReleased(lock.txHash)) {
    console.log(`  Already released`);
    return;
  }

  // Prevent concurrent release attempts for the same lock
  if (releasingSet.has(lock.txHash)) {
    return;
  }
  releasingSet.add(lock.txHash);

  // Random delay (0-3s) so witnesses don't all submit at the same instant
  const delay = Math.floor(Math.random() * 3000);
  await new Promise((r) => setTimeout(r, delay));

  // Re-check after delay — another witness may have released already
  if (isLockReleased(lock.txHash)) {
    releasingSet.delete(lock.txHash);
    console.log(`  Already released (after delay)`);
    return;
  }

  const name = getWitnessName();
  console.log(`\n[${name}] Quorum reached (${attCount}/${quorum}). Releasing...`);

  const destChain = lock.destChain;
  const client = listener.getClient(destChain);
  if (!client?.isConnected()) {
    console.error(`  Not connected to ${destChain}`);
    return;
  }

  const doorAddress = getDoorAddress(destChain);
  const chainConfig = getChainConfig(destChain);

  const releaseMemo = buildReleaseMemo({
    sourceTxHash: lock.txHash,
    sourceChain: lock.sourceChain,
  });

  try {
    // Get door sequence and ledger
    const accountInfo = await client.request({
      command: "account_info",
      account: doorAddress,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sequence = (accountInfo.result as any).account_data?.Sequence;

    const serverInfo = await client.request({ command: "server_info" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ledgerSeq = (serverInfo.result as any).info?.validated_ledger?.seq || 0;

    // Build release Payment
    const releaseTx: Record<string, unknown> = {
      TransactionType: "Payment",
      Account: doorAddress,
      Destination: lock.destination,
      Amount: lock.amount,
      Fee: String(12 * (quorum + 1)),
      Sequence: sequence,
      LastLedgerSequence: ledgerSeq + 30,
      Memos: [releaseMemo],
      SigningPubKey: "",
    };

    if (chainConfig.requiresNetworkId) {
      releaseTx.NetworkID = chainConfig.networkId;
    }

    // Multi-sign with available witness seeds
    const signedBlobs: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const seed = process.env[`WITNESS_${i}_SEED`];
      if (!seed) break;
      try {
        const w = XrplWallet.fromSeed(seed);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const signed = w.sign(releaseTx as any, true);
        signedBlobs.push(signed.tx_blob);
        if (signedBlobs.length >= quorum) break;
      } catch {
        // skip
      }
    }

    if (signedBlobs.length < quorum) {
      console.log(`  Only ${signedBlobs.length} local signatures — need ${quorum}`);
      return;
    }

    const multiSignedBlob = multisign(signedBlobs);
    console.log(`  Multi-signed with ${signedBlobs.length} witnesses`);

    // Submit
    const result = await client.request({
      command: "submit",
      tx_blob: multiSignedBlob,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sr = result.result as any;
    const engineResult = sr.engine_result;
    const hash = sr.tx_json?.hash;

    console.log(`  Result: ${engineResult}`);

    if (engineResult === "tesSUCCESS" || engineResult === "terQUEUED") {
      markReleased(lock.txHash, hash || "");
      console.log(`  ✅ Released: ${hash}`);
      console.log(`  Explorer: ${txUrl(chainConfig, hash)}`);
    } else if (engineResult === "tefPAST_SEQ" || engineResult === "tefALREADY") {
      // Another witness already submitted — this is fine
      markReleased(lock.txHash, "released-by-peer");
      console.log(`  ✓ Already released by another witness`);
    } else {
      console.error(`  ❌ ${engineResult}: ${sr.engine_result_message || ""}`);
    }
  } catch (e) {
    console.error(`  Release error: ${(e as Error).message}`);
  } finally {
    releasingSet.delete(lock.txHash);
  }
}
