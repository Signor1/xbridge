/**
 * Chain listener — subscribes to both chains, detects XChainCommit,
 * and triggers attestation. Handles reconnection on WebSocket drop.
 */

import { Client, Wallet } from "@transia/xrpl";
import { buildAndSubmitAttestation } from "./attestation";
import { isProcessed, markProcessed } from "./db";
import { getChains, getDoorAddresses, getEnv, getWitnessSeed, getWitnessName } from "./config";

let xahauClient: Client | null = null;
let xrplClient: Client | null = null;
let isRunning = false;

/** Connection status for health checks */
export function getConnectionStatus() {
  return {
    xahau: xahauClient?.isConnected() ?? false,
    xrpl: xrplClient?.isConnected() ?? false,
  };
}

async function handleTransaction(
  tx: Record<string, unknown>,
  sourceChain: "xahau" | "xrpl",
  destClient: Client,
) {
  if (tx.TransactionType !== "XChainCommit") return;

  // Check transaction succeeded (meta can be nested or top-level depending on subscription format)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = (tx.meta || (tx as any).metaData) as Record<string, unknown> | undefined;
  if (meta && meta.TransactionResult !== "tesSUCCESS") return;

  const txHash = tx.hash as string;
  if (!txHash) return;
  if (isProcessed(txHash)) return;

  const name = getWitnessName();
  console.log(`\n[${name}] [${sourceChain}] XChainCommit: ${txHash}`);
  console.log(`  Amount: ${JSON.stringify(tx.Amount)}`);
  console.log(`  ClaimID: ${tx.XChainClaimID}`);
  console.log(`  Destination: ${tx.OtherChainDestination}`);

  const witnessWallet = Wallet.fromSeed(getWitnessSeed());

  try {
    const result = await buildAndSubmitAttestation({
      destClient,
      witnessWallet,
      sourceChain,
      commitTx: tx,
    });
    markProcessed(txHash, sourceChain);
    console.log(`  ✅ Attestation submitted: ${result.txHash}`);
  } catch (err) {
    console.error(`  ❌ Attestation failed after retries: ${(err as Error).message}`);
    // Don't mark as processed — will retry if the commit is seen again
  }
}

async function connectAndSubscribe(
  client: Client,
  doorAddress: string,
  chainLabel: string,
  sourceChain: "xahau" | "xrpl",
  getDestClient: () => Client,
) {
  await client.connect();
  console.log(`Connected to ${chainLabel}`);

  await client.request({
    command: "subscribe",
    accounts: [doorAddress],
  });
  console.log(`Watching ${chainLabel} door: ${doorAddress}`);

  // Handle incoming transactions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).on("transaction", (event: Record<string, unknown>) => {
    const tx = (event.transaction || event) as Record<string, unknown>;
    if (tx?.TransactionType) {
      handleTransaction(tx, sourceChain, getDestClient()).catch((err) => {
        console.error(`[${chainLabel}] Handler error: ${(err as Error).message}`);
      });
    }
  });

  // Handle disconnection — attempt reconnect
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).on("disconnected", (code: number) => {
    console.warn(`[${chainLabel}] Disconnected (code ${code})`);
    if (isRunning) {
      console.log(`[${chainLabel}] Reconnecting in 5s...`);
      setTimeout(() => {
        connectAndSubscribe(client, doorAddress, chainLabel, sourceChain, getDestClient).catch(
          (err) => console.error(`[${chainLabel}] Reconnect failed: ${(err as Error).message}`),
        );
      }, 5000);
    }
  });
}

export const listener = {
  async start() {
    const chains = getChains(getEnv());
    const { xahauDoor, xrplDoor } = getDoorAddresses();
    isRunning = true;

    xahauClient = new Client(chains.xahau.wss);
    xrplClient = new Client(chains.xrpl.wss);

    await connectAndSubscribe(
      xahauClient,
      xahauDoor,
      chains.xahau.name,
      "xahau",
      () => xrplClient!,
    );

    await connectAndSubscribe(
      xrplClient,
      xrplDoor,
      chains.xrpl.name,
      "xrpl",
      () => xahauClient!,
    );
  },

  async stop() {
    isRunning = false;
    if (xahauClient?.isConnected()) await xahauClient.disconnect();
    if (xrplClient?.isConnected()) await xrplClient.disconnect();
    console.log("Disconnected from both chains");
  },
};
