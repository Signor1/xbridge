#!/usr/bin/env ts-node
/**
 * Step 4: Verify the bridge setup on both chains.
 */

import "dotenv/config";
import { Client } from "xrpl";
import { getChains, type NetworkEnv, type ChainId } from "@xbridge/config";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

async function verifyDoor(chainId: ChainId, doorAddress: string) {
  const chains = getChains(ENV);
  const chain = chains[chainId];

  console.log(`\n--- ${chain.name}: ${doorAddress} ---`);

  const client = new Client(chain.wss);
  if (chain.apiVersion === 1) client.apiVersion = 1;
  await client.connect();

  // Balance
  try {
    const balance = await client.getXrpBalance(doorAddress);
    console.log(`  Balance: ${balance}`);
  } catch {
    console.log(`  Balance: not found`);
  }

  // Account flags
  try {
    const info = await client.request({ command: "account_info", account: doorAddress });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags = (info.result as any).account_data?.Flags || 0;
    const masterDisabled = (flags & 0x00100000) !== 0;
    console.log(`  Master key disabled: ${masterDisabled ? "✅ yes" : "⚠ no"}`);
  } catch (e) {
    console.log(`  Account info: ${(e as Error).message}`);
  }

  // SignerList
  try {
    const objects = await client.request({
      command: "account_objects",
      account: doorAddress,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: "signer_list" as any,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signerLists = (objects.result as any).account_objects || [];
    if (signerLists.length > 0) {
      const sl = signerLists[0];
      const entries = sl.SignerEntries || [];
      console.log(`  SignerList: ✅ ${entries.length} signers, quorum ${sl.SignerQuorum}`);
      for (const entry of entries) {
        console.log(`    - ${entry.SignerEntry.Account} (weight ${entry.SignerEntry.SignerWeight})`);
      }
    } else {
      console.log(`  SignerList: ❌ not configured`);
    }
  } catch {
    console.log(`  SignerList: check failed`);
  }

  await client.disconnect();
}

async function verifyWitness(chainId: ChainId, address: string, label: string) {
  const chains = getChains(ENV);
  const chain = chains[chainId];
  const client = new Client(chain.wss);
  if (chain.apiVersion === 1) client.apiVersion = 1;
  await client.connect();

  try {
    const balance = await client.getXrpBalance(address);
    console.log(`  ${label} on ${chainId}: ✅ ${balance}`);
  } catch {
    console.log(`  ${label} on ${chainId}: ❌ not funded`);
  }

  await client.disconnect();
}

async function main() {
  const xahauDoor = process.env.XAHAU_DOOR_ADDRESS;
  const xrplDoor = process.env.XRPL_DOOR_ADDRESS;
  if (!xahauDoor || !xrplDoor) {
    console.error("Missing door addresses in .env");
    process.exit(1);
  }

  console.log(`\n=== XBridge: Verify Setup (${ENV}) ===`);

  await verifyDoor("xahau", xahauDoor);
  await verifyDoor("xrpl", xrplDoor);

  console.log("\n--- Witnesses ---");
  for (let i = 1; i <= 10; i++) {
    const addr = process.env[`WITNESS_${i}_ADDRESS`];
    if (!addr) break;
    await verifyWitness("xahau", addr, `Witness ${i}`);
    await verifyWitness("xrpl", addr, `Witness ${i}`);
  }

  const chains = getChains(ENV);
  console.log("\n--- Explorer ---");
  console.log(`Xahau Door: ${chains.xahau.explorer}/account/${xahauDoor}`);
  console.log(`XRPL Door:  ${chains.xrpl.explorer}/account/${xrplDoor}`);
}

main().catch(console.error);
