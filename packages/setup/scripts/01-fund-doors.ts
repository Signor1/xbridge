#!/usr/bin/env ts-node
/**
 * Step 1: Fund bridge door accounts on both chains
 *
 * Creates and funds two accounts:
 *   - Xahau door (locking chain) — holds locked assets
 *   - XRPL door (issuing chain) — mints wrapped assets
 *
 * For testnet, uses faucets. For mainnet, fund manually first.
 */

import "dotenv/config";
import { Client, Wallet } from "@transia/xrpl";
import { getChains, type NetworkEnv } from "@xbridge/config";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

async function main() {
  const chains = getChains(ENV);
  console.log(`\n=== XBridge: Fund Door Accounts (${ENV}) ===\n`);

  // Generate or load door wallets
  const xahauDoor = process.env.XAHAU_DOOR_SEED
    ? Wallet.fromSeed(process.env.XAHAU_DOOR_SEED)
    : Wallet.generate();

  const xrplDoor = process.env.XRPL_DOOR_SEED
    ? Wallet.fromSeed(process.env.XRPL_DOOR_SEED)
    : Wallet.generate();

  console.log(`Xahau Door: ${xahauDoor.address}`);
  console.log(`XRPL Door:  ${xrplDoor.address}`);

  if (ENV === "testnet") {
    // Fund via faucets
    console.log("\nFunding via testnet faucets...");

    const xahauClient = new Client(chains.xahau.wss);
    await xahauClient.connect();
    try {
      await xahauClient.fundWallet(xahauDoor);
      console.log(`  Xahau door funded: ${xahauDoor.address}`);
    } catch (e) {
      console.log(`  Xahau faucet: ${(e as Error).message}`);
    }
    await xahauClient.disconnect();

    const xrplClient = new Client(chains.xrpl.wss);
    await xrplClient.connect();
    try {
      await xrplClient.fundWallet(xrplDoor);
      console.log(`  XRPL door funded: ${xrplDoor.address}`);
    } catch (e) {
      console.log(`  XRPL faucet: ${(e as Error).message}`);
    }
    await xrplClient.disconnect();
  } else {
    console.log("\nMainnet: Fund these accounts manually before proceeding.");
  }

  console.log("\n=== Save these in .env ===");
  console.log(`XAHAU_DOOR_SEED=${xahauDoor.seed}`);
  console.log(`XAHAU_DOOR_ADDRESS=${xahauDoor.address}`);
  console.log(`XRPL_DOOR_SEED=${xrplDoor.seed}`);
  console.log(`XRPL_DOOR_ADDRESS=${xrplDoor.address}`);
}

main().catch(console.error);
