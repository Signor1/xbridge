#!/usr/bin/env ts-node
/**
 * Step 5: Verify bridge is operational on both chains
 *
 * Checks that bridge objects exist in both ledgers.
 */

import "dotenv/config";
import { Client } from "@transia/xrpl";
import { getChains, type NetworkEnv } from "@xbridge/config";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

async function checkBridge(client: Client, doorAddress: string, chainName: string) {
  console.log(`\n--- ${chainName}: Checking ${doorAddress} ---`);

  try {
    const result = await client.request({
      command: "account_objects",
      account: doorAddress,
      type: "bridge" as never,
    });

    const objects = (result.result as Record<string, unknown>).account_objects as unknown[];

    if (objects && objects.length > 0) {
      console.log(`  ✅ Bridge object found`);
      console.log(`  ${JSON.stringify(objects[0], null, 4)}`);
    } else {
      console.log(`  ❌ No bridge object on this account`);
    }
  } catch (e) {
    console.error(`  Error: ${(e as Error).message}`);
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

  const xahauClient = new Client(chains.xahau.wss);
  await xahauClient.connect();
  await checkBridge(xahauClient, xahauDoor, "Xahau");
  await xahauClient.disconnect();

  const xrplClient = new Client(chains.xrpl.wss);
  await xrplClient.connect();
  await checkBridge(xrplClient, xrplDoor, "XRPL");
  await xrplClient.disconnect();
}

main().catch(console.error);
