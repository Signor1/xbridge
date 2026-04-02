#!/usr/bin/env ts-node
/**
 * Step 5: Verify bridge is operational on both chains
 *
 * Checks:
 * - Bridge objects exist on both door accounts
 * - Door accounts are funded
 * - Witness accounts are funded on both chains
 */

import "dotenv/config";
import { Client } from "@transia/xrpl";
import { getChains, type NetworkEnv } from "@xbridge/config";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

async function checkBridge(client: Client, doorAddress: string, chainName: string) {
  console.log(`\n--- ${chainName}: ${doorAddress} ---`);

  // Check balance
  try {
    const balance = await client.getXrpBalance(doorAddress);
    console.log(`  Balance: ${balance} XRP`);
  } catch {
    console.log(`  Balance: account not found or not funded`);
  }

  // Check bridge object
  try {
    const result = await client.request({
      command: "account_objects",
      account: doorAddress,
      type: "bridge" as never,
    });

    const objects = (result.result as Record<string, unknown>).account_objects as unknown[];

    if (objects && objects.length > 0) {
      console.log(`  Bridge: ✅ found`);
      const bridge = objects[0] as Record<string, unknown>;
      const def = bridge.XChainBridge as Record<string, unknown> | undefined;
      if (def) {
        console.log(`    LockingDoor: ${def.LockingChainDoor}`);
        console.log(`    IssuingDoor: ${def.IssuingChainDoor}`);
        console.log(`    LockingIssue: ${JSON.stringify(def.LockingChainIssue)}`);
        console.log(`    IssuingIssue: ${JSON.stringify(def.IssuingChainIssue)}`);
      }
    } else {
      console.log(`  Bridge: ❌ not found`);
    }
  } catch (e) {
    console.error(`  Bridge check error: ${(e as Error).message}`);
  }

  // Check signer list
  try {
    const result = await client.request({
      command: "account_objects",
      account: doorAddress,
      type: "signer_list" as never,
    });

    const objects = (result.result as Record<string, unknown>).account_objects as unknown[];

    if (objects && objects.length > 0) {
      const signerList = objects[0] as Record<string, unknown>;
      const entries = signerList.SignerEntries as Array<Record<string, unknown>> | undefined;
      console.log(`  SignerList: ✅ ${entries?.length || 0} signers, quorum ${signerList.SignerQuorum}`);
    } else {
      console.log(`  SignerList: ⚠ not configured`);
    }
  } catch {
    console.log(`  SignerList: ⚠ check failed`);
  }
}

async function checkWitness(
  client: Client,
  address: string,
  chainName: string,
  witnessName: string,
) {
  try {
    const balance = await client.getXrpBalance(address);
    console.log(`  ${witnessName} on ${chainName}: ✅ ${balance} XRP`);
  } catch {
    console.log(`  ${witnessName} on ${chainName}: ❌ not funded`);
  }
}

async function main() {
  const chains = getChains(ENV);

  const xahauDoor = process.env.XAHAU_DOOR_ADDRESS;
  const xrplDoor = process.env.XRPL_DOOR_ADDRESS;

  if (!xahauDoor || !xrplDoor) {
    console.error("Missing XAHAU_DOOR_ADDRESS or XRPL_DOOR_ADDRESS in .env");
    process.exit(1);
  }

  console.log(`\n=== XBridge: Verify Bridge (${ENV}) ===`);

  // Check doors
  const xahauClient = new Client(chains.xahau.wss);
  await xahauClient.connect();
  await checkBridge(xahauClient, xahauDoor, "Xahau");

  const xrplClient = new Client(chains.xrpl.wss);
  await xrplClient.connect();
  await checkBridge(xrplClient, xrplDoor, "XRPL");

  // Check witnesses
  console.log("\n--- Witnesses ---");
  for (let i = 1; i <= 10; i++) {
    const xahauAddr = process.env[`WITNESS_${i}_XAHAU_ADDRESS`];
    const xrplAddr = process.env[`WITNESS_${i}_XRPL_ADDRESS`];
    if (!xahauAddr || !xrplAddr) break;

    await checkWitness(xahauClient, xahauAddr, "Xahau", `Witness ${i}`);
    await checkWitness(xrplClient, xrplAddr, "XRPL", `Witness ${i}`);
  }

  await xahauClient.disconnect();
  await xrplClient.disconnect();

  // Explorer links
  console.log("\n--- Explorer ---");
  console.log(`Xahau Door: ${chains.xahau.explorer}/account/${xahauDoor}`);
  console.log(`XRPL Door:  ${chains.xrpl.explorer}/account/${xrplDoor}`);
}

main().catch(console.error);
