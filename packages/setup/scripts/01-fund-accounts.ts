#!/usr/bin/env ts-node
/**
 * Step 1: Fund door accounts and witness accounts on both chains.
 *
 * For testnet: uses HTTP faucets.
 * For mainnet: prints addresses for manual funding.
 */

import "dotenv/config";
import { Wallet } from "xrpl";
import { getChains, type NetworkEnv, type ChainId } from "@xbridge/config";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

async function fundViaFaucet(faucetUrl: string, address: string): Promise<number> {
  const res = await fetch(faucetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destination: address }),
  });
  if (!res.ok) throw new Error(`Faucet ${res.status}`);
  const data = (await res.json()) as { amount?: number };
  return data.amount || 0;
}

function loadOrGenerate(seedEnv: string, label: string): Wallet {
  const seed = process.env[seedEnv];
  if (seed) {
    const w = Wallet.fromSeed(seed);
    console.log(`  ${label}: ${w.address} (loaded)`);
    return w;
  }
  const w = Wallet.generate();
  console.log(`  ${label}: ${w.address} (generated)`);
  return w;
}

async function fundAccount(chain: ChainId, address: string, label: string) {
  const chains = getChains(ENV);
  const faucet = chains[chain].faucet;
  if (!faucet) {
    console.log(`  ${label}: fund manually`);
    return;
  }
  try {
    const amount = await fundViaFaucet(faucet, address);
    console.log(`  ${label} on ${chain}: ${amount} funded`);
  } catch (e) {
    console.error(`  ${label} on ${chain}: ${(e as Error).message}`);
  }
}

async function main() {
  console.log(`\n=== XBridge: Fund Accounts (${ENV}) ===\n`);

  // Door accounts
  console.log("Door accounts:");
  const xahauDoor = loadOrGenerate("XAHAU_DOOR_SEED", "Xahau Door");
  const xrplDoor = loadOrGenerate("XRPL_DOOR_SEED", "XRPL Door");

  // Witness accounts
  console.log("\nWitness accounts:");
  const witnesses: { seed: string; address: string; publicKey: string }[] = [];
  for (let i = 1; i <= 3; i++) {
    const w = loadOrGenerate(`WITNESS_${i}_SEED`, `Witness ${i}`);
    witnesses.push({ seed: w.seed!, address: w.address, publicKey: w.publicKey });
  }

  // Fund
  if (ENV === "testnet") {
    console.log("\n--- Funding ---");
    await fundAccount("xahau", xahauDoor.address, "Xahau door");
    await fundAccount("xrpl", xrplDoor.address, "XRPL door");
    for (let i = 0; i < witnesses.length; i++) {
      await fundAccount("xahau", witnesses[i]!.address, `Witness ${i + 1}`);
      await fundAccount("xrpl", witnesses[i]!.address, `Witness ${i + 1}`);
    }
  }

  // Output
  console.log("\n=== Add to .env ===\n");
  console.log(`XAHAU_DOOR_SEED=${xahauDoor.seed}`);
  console.log(`XAHAU_DOOR_ADDRESS=${xahauDoor.address}`);
  console.log(`XRPL_DOOR_SEED=${xrplDoor.seed}`);
  console.log(`XRPL_DOOR_ADDRESS=${xrplDoor.address}`);
  for (let i = 0; i < witnesses.length; i++) {
    const w = witnesses[i]!;
    console.log(`WITNESS_${i + 1}_SEED=${w.seed}`);
    console.log(`WITNESS_${i + 1}_ADDRESS=${w.address}`);
  }
  console.log(`BRIDGE_QUORUM=2`);
}

main().catch(console.error);
