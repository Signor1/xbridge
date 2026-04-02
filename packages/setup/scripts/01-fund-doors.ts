#!/usr/bin/env ts-node
/**
 * Step 1: Fund bridge door accounts and witness accounts on both chains
 *
 * Creates and funds:
 *   - Xahau door (locking chain) — holds locked assets
 *   - XRPL door (issuing chain) — mints wrapped assets
 *   - 3 witness accounts on both chains
 *
 * For testnet, uses faucets. For mainnet, prints addresses for manual funding.
 */

import "dotenv/config";
import { Wallet } from "@transia/xrpl";
import { getChains, type NetworkEnv } from "@xbridge/config";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

async function fundViaFaucet(
  faucetUrl: string,
  address?: string,
): Promise<{ address: string; seed?: string; amount: number }> {
  const body = address ? JSON.stringify({ destination: address }) : undefined;
  const res = await fetch(faucetUrl, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : {},
    body,
  });

  if (!res.ok) {
    throw new Error(`Faucet returned ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    account: { address: string; classicAddress: string; secret?: string };
    amount: number;
    seed?: string;
  };

  return {
    address: data.account.classicAddress || data.account.address,
    seed: data.account.secret || data.seed,
    amount: data.amount,
  };
}

function loadOrGenerate(seedEnv: string, label: string): Wallet {
  const seed = process.env[seedEnv];
  if (seed) {
    const wallet = Wallet.fromSeed(seed);
    console.log(`  ${label}: ${wallet.address} (loaded from ${seedEnv})`);
    return wallet;
  }
  const wallet = Wallet.generate();
  console.log(`  ${label}: ${wallet.address} (generated)`);
  return wallet;
}

async function main() {
  const chains = getChains(ENV);
  console.log(`\n=== XBridge: Fund Accounts (${ENV}) ===\n`);

  // --- Door accounts ---
  console.log("Door accounts:");
  const xahauDoor = loadOrGenerate("XAHAU_DOOR_SEED", "Xahau Door");
  const xrplDoor = loadOrGenerate("XRPL_DOOR_SEED", "XRPL Door");

  // --- Witness accounts ---
  console.log("\nWitness accounts:");
  const witnesses: { seed: string; xahauAddress: string; xrplAddress: string; publicKey: string }[] = [];

  for (let i = 1; i <= 3; i++) {
    // Each witness uses the same seed on both chains (same keypair, different networks)
    const witness = loadOrGenerate(`WITNESS_${i}_SEED`, `Witness ${i}`);
    witnesses.push({
      seed: witness.seed!,
      xahauAddress: witness.address,
      xrplAddress: witness.address, // same keypair = same address
      publicKey: witness.publicKey,
    });
  }

  // --- Fund on testnet ---
  if (ENV === "testnet") {
    console.log("\n--- Funding via testnet faucets ---\n");

    const xahauFaucet = chains.xahau.faucet!;
    const xrplFaucet = chains.xrpl.faucet!;

    // Fund Xahau door
    try {
      const r = await fundViaFaucet(xahauFaucet, xahauDoor.address);
      console.log(`  Xahau door funded: ${r.amount} XAH`);
    } catch (e) {
      console.error(`  Xahau door fund failed: ${(e as Error).message}`);
    }

    // Fund XRPL door
    try {
      const r = await fundViaFaucet(xrplFaucet, xrplDoor.address);
      console.log(`  XRPL door funded: ${r.amount} XRP`);
    } catch (e) {
      console.error(`  XRPL door fund failed: ${(e as Error).message}`);
    }

    // Fund witnesses on both chains
    for (let i = 0; i < witnesses.length; i++) {
      const w = witnesses[i]!;
      try {
        await fundViaFaucet(xahauFaucet, w.xahauAddress);
        console.log(`  Witness ${i + 1} funded on Xahau`);
      } catch (e) {
        console.error(`  Witness ${i + 1} Xahau fund failed: ${(e as Error).message}`);
      }

      try {
        await fundViaFaucet(xrplFaucet, w.xrplAddress);
        console.log(`  Witness ${i + 1} funded on XRPL`);
      } catch (e) {
        console.error(`  Witness ${i + 1} XRPL fund failed: ${(e as Error).message}`);
      }
    }
  } else {
    console.log("\nMainnet: Fund all accounts manually before proceeding.");
    console.log("Each account needs enough native currency to cover reserves and tx fees.");
  }

  // --- Print .env values ---
  console.log("\n=== Add these to packages/setup/.env ===\n");
  console.log(`XBRIDGE_ENV=${ENV}`);
  console.log(`XAHAU_DOOR_SEED=${xahauDoor.seed}`);
  console.log(`XAHAU_DOOR_ADDRESS=${xahauDoor.address}`);
  console.log(`XRPL_DOOR_SEED=${xrplDoor.seed}`);
  console.log(`XRPL_DOOR_ADDRESS=${xrplDoor.address}`);
  console.log(`BRIDGE_CURRENCY=XRP`);
  console.log(`BRIDGE_ISSUER=`);

  for (let i = 0; i < witnesses.length; i++) {
    const w = witnesses[i]!;
    console.log(`WITNESS_${i + 1}_SEED=${w.seed}`);
    console.log(`WITNESS_${i + 1}_XAHAU_ADDRESS=${w.xahauAddress}`);
    console.log(`WITNESS_${i + 1}_XRPL_ADDRESS=${w.xrplAddress}`);
  }

  console.log(`BRIDGE_QUORUM=2`);

  // --- Print explorer links ---
  console.log("\n=== Explorer Links ===\n");
  console.log(`Xahau Door: ${chains.xahau.explorer}/account/${xahauDoor.address}`);
  console.log(`XRPL Door:  ${chains.xrpl.explorer}/account/${xrplDoor.address}`);
  for (let i = 0; i < witnesses.length; i++) {
    console.log(`Witness ${i + 1}: ${chains.xahau.explorer}/account/${witnesses[i]!.xahauAddress}`);
  }
}

main().catch(console.error);
