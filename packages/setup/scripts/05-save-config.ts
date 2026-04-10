#!/usr/bin/env ts-node
/**
 * Step 5: Save bridge config JSON for other packages.
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { Wallet } from "xrpl";
import type { BridgeConfig, WitnessConfig } from "@xbridge/config";

const ENV = process.env.XBRIDGE_ENV || "testnet";

async function main() {
  console.log(`\n=== XBridge: Save Config (${ENV}) ===\n`);

  const xahauDoor = process.env.XAHAU_DOOR_ADDRESS;
  const xrplDoor = process.env.XRPL_DOOR_ADDRESS;
  if (!xahauDoor || !xrplDoor) {
    console.error("Missing door addresses");
    process.exit(1);
  }

  const currency = process.env.BRIDGE_CURRENCY || "XRP";
  const issuer = process.env.BRIDGE_ISSUER;
  const quorum = parseInt(process.env.BRIDGE_QUORUM || "2", 10);

  const witnesses: WitnessConfig[] = [];
  for (let i = 1; i <= 10; i++) {
    const seed = process.env[`WITNESS_${i}_SEED`];
    const addr = process.env[`WITNESS_${i}_ADDRESS`];
    if (!seed || !addr) break;
    const w = Wallet.fromSeed(seed);
    witnesses.push({
      name: `witness-${i}`,
      publicKey: w.publicKey,
      xahauAccount: addr,
      xrplAccount: addr,
      peerUrl: `http://localhost:${3000 + i}`,
    });
  }

  const config: BridgeConfig = {
    name: `xbridge-${ENV}`,
    env: ENV as "testnet" | "mainnet",
    xahauDoor,
    xrplDoor,
    token: currency === "XRP" && !issuer ? { currency: "XRP" } : { currency, issuer: issuer! },
    witnesses,
    quorum,
  };

  const configDir = path.resolve(__dirname, "../../config/bridges");
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, `${ENV}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`Saved: ${configPath}`);
  console.log(JSON.stringify(config, null, 2));
}

main().catch(console.error);
