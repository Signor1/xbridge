/**
 * Build and submit XChainAddClaimAttestation transactions
 */

import { Client, Wallet } from "@transia/xrpl";
import { getBridgeDefinition, getChains, getEnv, getRetryConfig } from "./config";

export interface AttestationParams {
  destClient: Client;
  witnessWallet: Wallet;
  sourceChain: "xahau" | "xrpl";
  commitTx: Record<string, unknown>;
}

export interface AttestationResult {
  txHash: string;
  result: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function submitAttestation(params: AttestationParams): Promise<AttestationResult> {
  const { destClient, witnessWallet, sourceChain, commitTx } = params;
  const chains = getChains(getEnv());
  const bridgeDef = getBridgeDefinition();

  // Build attestation transaction
  const attestation: Record<string, unknown> = {
    TransactionType: "XChainAddClaimAttestation",
    Account: witnessWallet.address,
    XChainBridge: {
      LockingChainDoor: bridgeDef.LockingChainDoor,
      LockingChainIssue: bridgeDef.LockingChainIssue,
      IssuingChainDoor: bridgeDef.IssuingChainDoor,
      IssuingChainIssue: bridgeDef.IssuingChainIssue,
    },
    XChainClaimID: commitTx.XChainClaimID,
    Amount: commitTx.Amount,
    OtherChainSource: commitTx.Account,
    Destination: commitTx.OtherChainDestination || "",
    PublicKey: witnessWallet.publicKey,
    WasLockingChainSend: sourceChain === "xahau" ? 1 : 0,
    AttestationSignerAccount: witnessWallet.address,
  };

  // Add NetworkID if destination chain requires it
  const destChain = sourceChain === "xahau" ? chains.xrpl : chains.xahau;
  if (destChain.networkId > 0) {
    attestation.NetworkID = destChain.networkId;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await destClient.submitAndWait(attestation as any, {
    wallet: witnessWallet,
    autofill: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result.result as any;
  const txResult = r.meta?.TransactionResult || "unknown";
  const hash = r.hash || "";

  console.log(`  Attestation result: ${txResult} (${hash})`);

  if (txResult !== "tesSUCCESS") {
    throw new Error(`Attestation failed: ${txResult}`);
  }

  return { txHash: hash, result: txResult };
}

/**
 * Build and submit attestation with retry logic
 */
export async function buildAndSubmitAttestation(
  params: AttestationParams,
): Promise<AttestationResult> {
  const { maxRetries, retryDelayMs } = getRetryConfig();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await submitAttestation(params);
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`  Attempt ${attempt}/${maxRetries} failed: ${msg}`);

      if (attempt < maxRetries) {
        console.log(`  Retrying in ${retryDelayMs}ms...`);
        await sleep(retryDelayMs);
      } else {
        throw err;
      }
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error("Attestation failed after all retries");
}
