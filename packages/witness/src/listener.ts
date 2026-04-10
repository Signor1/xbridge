/**
 * Chain listener — subscribes to door accounts on both chains,
 * detects lock Payments, and triggers attestation + release flow.
 */

import { Client } from "@transia/xrpl";
import { parseMemo, type LockEvent, type ChainId, getOtherChain } from "@xbridge/config";
import { getChainConfig, getDoorAddress, getWitnessName } from "./config";
import { signAttestation } from "./attestation";
import { isLockProcessed, isLockReleased, saveLock, saveAttestation, getAttestationCount } from "./db";
import { broadcastAttestation } from "./peer";
import { tryRelease } from "./releaser";

let xahauClient: Client | null = null;
let xrplClient: Client | null = null;
let isRunning = false;

export function getConnectionStatus() {
  return {
    xahau: xahauClient?.isConnected() ?? false,
    xrpl: xrplClient?.isConnected() ?? false,
  };
}

async function handleTransaction(
  tx: Record<string, unknown>,
  sourceChain: ChainId,
) {
  // Only process successful Payments to the door account
  if (tx.TransactionType !== "Payment") return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = (tx.meta || (tx as any).metaData) as Record<string, unknown> | undefined;
  if (meta && meta.TransactionResult !== "tesSUCCESS") return;

  const txHash = tx.hash as string;
  if (!txHash) return;

  // Check if this Payment is to the door account
  const doorAddress = getDoorAddress(sourceChain);
  if (tx.Destination !== doorAddress) return;

  // Parse memo for bridge lock instruction
  const memos = tx.Memos as Array<{ Memo: { MemoType?: string; MemoData?: string } }> | undefined;
  if (!memos || memos.length === 0) return;

  const parsed = parseMemo(memos[0]!);
  if (!parsed || parsed.type !== "lock") return;

  // Already processed?
  if (isLockProcessed(txHash)) return;

  const lock: LockEvent = {
    txHash,
    sourceChain,
    destChain: getOtherChain(sourceChain),
    sender: tx.Account as string,
    destination: parsed.data.destination,
    amount: typeof tx.Amount === "string" ? tx.Amount : (tx.Amount as Record<string, string>).value,
    currency: typeof tx.Amount === "string" ? "XRP" : (tx.Amount as Record<string, string>).currency,
    issuer: typeof tx.Amount === "object" ? (tx.Amount as Record<string, string>).issuer : undefined,
    detectedAt: Math.floor(Date.now() / 1000),
  };

  const name = getWitnessName();
  console.log(`\n[${name}] Lock detected on ${sourceChain}: ${txHash}`);
  console.log(`  Amount: ${lock.amount} ${lock.currency}`);
  console.log(`  Destination: ${lock.destination}`);

  // Save lock
  saveLock(txHash, sourceChain, lock.amount, lock.destination);

  // Sign attestation
  const attestation = signAttestation(lock);
  saveAttestation(txHash, attestation.witnessAccount, attestation.witnessPublicKey, attestation.signature);
  console.log(`  Attestation signed`);

  // Broadcast to peer witnesses
  await broadcastAttestation(attestation);

  // Check if we have quorum and can release
  await tryRelease(lock);
}

async function connectAndSubscribe(
  client: Client,
  chain: ChainId,
) {
  const chainConfig = getChainConfig(chain);
  await client.connect();
  console.log(`Connected to ${chainConfig.name}`);

  const doorAddress = getDoorAddress(chain);
  await client.request({ command: "subscribe", accounts: [doorAddress] });
  console.log(`Watching ${chain} door: ${doorAddress}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).on("transaction", (event: Record<string, unknown>) => {
    const tx = (event.transaction || event) as Record<string, unknown>;
    if (tx?.TransactionType) {
      handleTransaction(tx, chain).catch((err) => {
        console.error(`[${chain}] Handler error: ${(err as Error).message}`);
      });
    }
  });

  // Reconnect on disconnect
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).on("disconnected", (code: number) => {
    console.warn(`[${chain}] Disconnected (${code})`);
    if (isRunning) {
      console.log(`[${chain}] Reconnecting in 5s...`);
      setTimeout(() => {
        connectAndSubscribe(client, chain).catch((err) =>
          console.error(`[${chain}] Reconnect failed: ${(err as Error).message}`),
        );
      }, 5000);
    }
  });
}

export const listener = {
  async start() {
    isRunning = true;
    const xahauConfig = getChainConfig("xahau");
    const xrplConfig = getChainConfig("xrpl");

    xahauClient = new Client(xahauConfig.wss);
    // Xahau requires apiVersion 1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (xahauConfig.apiVersion === 1) (xahauClient as any).apiVersion = 1;

    xrplClient = new Client(xrplConfig.wss);

    await connectAndSubscribe(xahauClient, "xahau");
    await connectAndSubscribe(xrplClient, "xrpl");
  },

  async stop() {
    isRunning = false;
    if (xahauClient?.isConnected()) await xahauClient.disconnect();
    if (xrplClient?.isConnected()) await xrplClient.disconnect();
    console.log("Disconnected from both chains");
  },

  /** Get client for a chain (used by releaser) */
  getClient(chain: ChainId): Client | null {
    return chain === "xahau" ? xahauClient : xrplClient;
  },
};
