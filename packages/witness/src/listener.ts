/**
 * Chain listener — subscribes to both chains and detects XChainCommit events
 */

import { Client, Wallet } from "@transia/xrpl";
import { getChains, type NetworkEnv } from "@xbridge/config";
import { buildAndSubmitAttestation } from "./attestation";
import { isProcessed, markProcessed } from "./db";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

let xahauClient: Client | null = null;
let xrplClient: Client | null = null;

function getWitnessSeed(): string {
  const seed = process.env.WITNESS_SEED;
  if (!seed) throw new Error("WITNESS_SEED not set in .env");
  return seed;
}

function getDoorAddresses() {
  const xahauDoor = process.env.XAHAU_DOOR_ADDRESS;
  const xrplDoor = process.env.XRPL_DOOR_ADDRESS;
  if (!xahauDoor || !xrplDoor) {
    throw new Error("Missing XAHAU_DOOR_ADDRESS or XRPL_DOOR_ADDRESS");
  }
  return { xahauDoor, xrplDoor };
}

async function handleTransaction(
  tx: Record<string, unknown>,
  sourceChain: "xahau" | "xrpl",
  destClient: Client,
) {
  // Only process XChainCommit transactions
  if (tx.TransactionType !== "XChainCommit") return;

  const meta = tx.meta as Record<string, unknown> | undefined;
  if (!meta || meta.TransactionResult !== "tesSUCCESS") return;

  const txHash = tx.hash as string;
  if (isProcessed(txHash)) return;

  console.log(`\n[${sourceChain}] XChainCommit detected: ${txHash}`);
  console.log(`  Amount: ${JSON.stringify(tx.Amount)}`);
  console.log(`  ClaimID: ${tx.XChainClaimID}`);
  console.log(`  Destination: ${tx.OtherChainDestination}`);

  const witnessWallet = Wallet.fromSeed(getWitnessSeed());

  try {
    await buildAndSubmitAttestation({
      destClient,
      witnessWallet,
      sourceChain,
      commitTx: tx,
    });
    markProcessed(txHash);
    console.log(`  ✅ Attestation submitted`);
  } catch (err) {
    console.error(`  ❌ Attestation failed: ${(err as Error).message}`);
  }
}

export const listener = {
  async start() {
    const chains = getChains(ENV);
    const { xahauDoor, xrplDoor } = getDoorAddresses();

    // Connect to Xahau
    xahauClient = new Client(chains.xahau.wss);
    await xahauClient.connect();
    console.log(`Connected to ${chains.xahau.name}`);

    // Connect to XRPL
    xrplClient = new Client(chains.xrpl.wss);
    await xrplClient.connect();
    console.log(`Connected to ${chains.xrpl.name}`);

    // Subscribe to Xahau door account (detects Xahau → XRPL commits)
    await xahauClient.request({
      command: "subscribe",
      accounts: [xahauDoor],
    });
    console.log(`Watching Xahau door: ${xahauDoor}`);

    xahauClient.on("transaction", (event: Record<string, unknown>) => {
      const tx = event.transaction as Record<string, unknown>;
      if (tx) handleTransaction(tx, "xahau", xrplClient!);
    });

    // Subscribe to XRPL door account (detects XRPL → Xahau commits)
    await xrplClient.request({
      command: "subscribe",
      accounts: [xrplDoor],
    });
    console.log(`Watching XRPL door: ${xrplDoor}`);

    xrplClient.on("transaction", (event: Record<string, unknown>) => {
      const tx = event.transaction as Record<string, unknown>;
      if (tx) handleTransaction(tx, "xrpl", xahauClient!);
    });
  },

  async stop() {
    if (xahauClient?.isConnected()) await xahauClient.disconnect();
    if (xrplClient?.isConnected()) await xrplClient.disconnect();
    console.log("Disconnected from both chains");
  },
};
