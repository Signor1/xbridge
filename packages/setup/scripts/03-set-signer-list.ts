#!/usr/bin/env ts-node
/**
 * Step 3: Set SignerList on door accounts for multisig security
 *
 * Adds witness accounts as signers on both door accounts.
 * After this, administrative operations on the doors require
 * quorum witness signatures.
 *
 * WARNING: After disabling the master key (optional step),
 * only the signer list can authorize transactions on the door.
 */

import "dotenv/config";
import { Client, Wallet } from "@transia/xrpl";
import { getChains, type NetworkEnv } from "@xbridge/config";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

function getWitnessAccounts(): { xahauAddress: string; xrplAddress: string }[] {
  const witnesses: { xahauAddress: string; xrplAddress: string }[] = [];
  for (let i = 1; i <= 10; i++) {
    const xahau = process.env[`WITNESS_${i}_XAHAU_ADDRESS`];
    const xrpl = process.env[`WITNESS_${i}_XRPL_ADDRESS`];
    if (xahau && xrpl) {
      witnesses.push({ xahauAddress: xahau, xrplAddress: xrpl });
    }
  }
  return witnesses;
}

async function setSignerList(
  client: Client,
  doorWallet: Wallet,
  signerAddresses: string[],
  quorum: number,
  networkId: number,
  chainName: string,
) {
  console.log(`\n--- Setting SignerList on ${chainName} door ---`);
  console.log(`  Door: ${doorWallet.address}`);
  console.log(`  Signers: ${signerAddresses.length}`);
  console.log(`  Quorum: ${quorum}`);

  const signerEntries = signerAddresses.map((addr) => ({
    SignerEntry: {
      Account: addr,
      SignerWeight: 1,
    },
  }));

  const tx: Record<string, unknown> = {
    TransactionType: "SignerListSet",
    Account: doorWallet.address,
    SignerQuorum: quorum,
    SignerEntries: signerEntries,
  };

  if (networkId > 0) {
    tx.NetworkID = networkId;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await client.submitAndWait(tx as any, {
      wallet: doorWallet,
      autofill: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result.result as any;
    const txResult = r.meta?.TransactionResult || "unknown";
    console.log(`  Result: ${txResult}`);
    console.log(`  Hash: ${r.hash}`);
  } catch (e) {
    console.error(`  Error: ${(e as Error).message}`);
  }
}

async function main() {
  const chains = getChains(ENV);

  const xahauDoorSeed = process.env.XAHAU_DOOR_SEED;
  const xrplDoorSeed = process.env.XRPL_DOOR_SEED;

  if (!xahauDoorSeed || !xrplDoorSeed) {
    console.error("Missing door seeds in .env");
    process.exit(1);
  }

  const witnesses = getWitnessAccounts();
  if (witnesses.length === 0) {
    console.error("No witness accounts found in .env (WITNESS_1_XAHAU_ADDRESS, etc.)");
    process.exit(1);
  }

  const quorum = parseInt(process.env.BRIDGE_QUORUM || "2", 10);
  const xahauDoor = Wallet.fromSeed(xahauDoorSeed);
  const xrplDoor = Wallet.fromSeed(xrplDoorSeed);

  console.log(`\n=== XBridge: Set Signer Lists (${ENV}) ===`);

  // Xahau
  const xahauClient = new Client(chains.xahau.wss);
  await xahauClient.connect();
  await setSignerList(
    xahauClient,
    xahauDoor,
    witnesses.map((w) => w.xahauAddress),
    quorum,
    chains.xahau.networkId,
    "Xahau",
  );
  await xahauClient.disconnect();

  // XRPL
  const xrplClient = new Client(chains.xrpl.wss);
  await xrplClient.connect();
  await setSignerList(
    xrplClient,
    xrplDoor,
    witnesses.map((w) => w.xrplAddress),
    quorum,
    chains.xrpl.networkId,
    "XRPL",
  );
  await xrplClient.disconnect();

  console.log("\n=== Signer lists configured ===");
  console.log("Next: Run 04-setup-trust.ts if bridging IOUs (skip for native XRP/XAH)");
}

main().catch(console.error);
