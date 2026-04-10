#!/usr/bin/env ts-node
/**
 * Step 2: Set SignerList on door accounts.
 *
 * Adds witness public keys as signers so the door accounts
 * can only move funds via multi-signed transactions.
 */

import "dotenv/config";
import { Client, Wallet } from "xrpl";
import { getChains, type NetworkEnv, type ChainId } from "@xbridge/config";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

function getWitnesses(): { address: string; publicKey: string }[] {
  const list: { address: string; publicKey: string }[] = [];
  for (let i = 1; i <= 10; i++) {
    const seed = process.env[`WITNESS_${i}_SEED`];
    const addr = process.env[`WITNESS_${i}_ADDRESS`];
    if (!seed || !addr) break;
    const w = Wallet.fromSeed(seed);
    list.push({ address: addr, publicKey: w.publicKey });
  }
  return list;
}

async function setSignerList(
  chainId: ChainId,
  doorSeed: string,
  witnesses: { address: string }[],
  quorum: number,
) {
  const chains = getChains(ENV);
  const chain = chains[chainId];
  const door = Wallet.fromSeed(doorSeed);

  console.log(`\n--- ${chain.name}: SignerList on ${door.address} ---`);

  const client = new Client(chain.wss);
  if (chain.apiVersion === 1) client.apiVersion = 1;
  await client.connect();

  const signerEntries = witnesses.map((w) => ({
    SignerEntry: { Account: w.address, SignerWeight: 1 },
  }));

  const tx: Record<string, unknown> = {
    TransactionType: "SignerListSet",
    Account: door.address,
    SignerQuorum: quorum,
    SignerEntries: signerEntries,
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
    console.error("Missing door seeds. Run 01-fund-accounts.ts first.");
    process.exit(1);
  }

  const witnesses = getWitnesses();
  if (witnesses.length === 0) {
    console.error("No witnesses in .env");
    process.exit(1);
  }

  const quorum = parseInt(process.env.BRIDGE_QUORUM || "2", 10);
  console.log(`\n=== XBridge: Set Signer Lists (${ENV}) ===`);
  console.log(`Witnesses: ${witnesses.length}, Quorum: ${quorum}`);

  await setSignerList("xahau", xahauDoorSeed, witnesses, quorum);
  await setSignerList("xrpl", xrplDoorSeed, witnesses, quorum);

  console.log("\nDone. Next: 03-disable-master.ts");
}

main().catch(console.error);
