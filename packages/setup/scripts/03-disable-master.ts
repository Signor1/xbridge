#!/usr/bin/env ts-node
/**
 * Step 3: Disable master key on door accounts.
 *
 * After this, ONLY the SignerList (witnesses) can authorize transactions.
 * This is critical for security — prevents any single party from moving funds.
 *
 * WARNING: This is irreversible unless the SignerList can re-enable it.
 * Only run after verifying SignerList is correctly configured.
 */

import "dotenv/config";
import { Client, Wallet } from "xrpl";
import { getChains, type NetworkEnv, type ChainId } from "@xbridge/config";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

async function disableMasterKey(chainId: ChainId, doorSeed: string) {
  const chains = getChains(ENV);
  const chain = chains[chainId];
  const door = Wallet.fromSeed(doorSeed);

  console.log(`\n--- ${chain.name}: Disable master key on ${door.address} ---`);

  const client = new Client(chain.wss);
  if (chain.apiVersion === 1) client.apiVersion = 1;
  await client.connect();

  // asfDisableMaster = 4
  const tx: Record<string, unknown> = {
    TransactionType: "AccountSet",
    Account: door.address,
    SetFlag: 4,
  };

  if (chain.requiresNetworkId) tx.NetworkID = chain.networkId;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await client.submitAndWait(tx as any, { wallet: door, autofill: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result.result as any;
    console.log(`  Result: ${r.meta?.TransactionResult || "unknown"}`);
    console.log(`  Hash: ${r.hash}`);
  } catch (e) {
    console.error(`  Error: ${(e as Error).message}`);
  }

  await client.disconnect();
}

async function main() {
  const xahauDoorSeed = process.env.XAHAU_DOOR_SEED;
  const xrplDoorSeed = process.env.XRPL_DOOR_SEED;
  if (!xahauDoorSeed || !xrplDoorSeed) {
    console.error("Missing door seeds.");
    process.exit(1);
  }

  console.log(`\n=== XBridge: Disable Master Keys (${ENV}) ===`);
  console.log("WARNING: This is irreversible. Only proceed if SignerList is set correctly.\n");

  await disableMasterKey("xahau", xahauDoorSeed);
  await disableMasterKey("xrpl", xrplDoorSeed);

  console.log("\nDone. Door accounts now controlled exclusively by witnesses.");
  console.log("Next: 04-verify.ts");
}

main().catch(console.error);
