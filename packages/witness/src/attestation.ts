/**
 * Build and submit XChainAddClaimAttestation transactions
 */

import { Client, Wallet } from "@transia/xrpl";
import { getChains, type NetworkEnv } from "@xbridge/config";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

interface AttestationParams {
  destClient: Client;
  witnessWallet: Wallet;
  sourceChain: "xahau" | "xrpl";
  commitTx: Record<string, unknown>;
}

export async function buildAndSubmitAttestation(params: AttestationParams) {
  const { destClient, witnessWallet, sourceChain, commitTx } = params;
  const chains = getChains(ENV);

  const xahauDoor = process.env.XAHAU_DOOR_ADDRESS!;
  const xrplDoor = process.env.XRPL_DOOR_ADDRESS!;

  // Build the bridge definition (must match what's on-chain)
  const bridgeDef = {
    LockingChainDoor: xahauDoor,
    LockingChainIssue: { currency: "XRP" },
    IssuingChainDoor: xrplDoor,
    IssuingChainIssue: { currency: "XRP" },
  };

  // Build attestation transaction
  const attestation: Record<string, unknown> = {
    TransactionType: "XChainAddClaimAttestation",
    Account: witnessWallet.address,
    XChainBridge: bridgeDef,
    XChainClaimID: commitTx.XChainClaimID,
    Amount: commitTx.Amount,
    OtherChainSource: commitTx.Account,
    Destination: commitTx.OtherChainDestination || "",
    PublicKey: witnessWallet.publicKey,
    WasLockingChainSend: sourceChain === "xahau" ? 1 : 0,
    AttestationSignerAccount: witnessWallet.address,
  };

  // Add NetworkID for Xahau destination
  const destChain = sourceChain === "xahau" ? chains.xrpl : chains.xahau;
  if (destChain.networkId > 0) {
    attestation.NetworkID = destChain.networkId;
  }

  // Submit
  const result = await destClient.submitAndWait(attestation, {
    wallet: witnessWallet,
    autofill: true,
  });

  const meta = (result.result as Record<string, unknown>).meta as
    | Record<string, unknown>
    | undefined;
  const txResult = meta?.TransactionResult || "unknown";
  const hash = (result.result as Record<string, unknown>).hash;

  console.log(`  Attestation result: ${txResult} (${hash})`);

  if (txResult !== "tesSUCCESS") {
    throw new Error(`Attestation failed: ${txResult}`);
  }

  return { txHash: hash, result: txResult };
}
