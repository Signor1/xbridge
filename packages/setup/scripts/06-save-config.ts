#!/usr/bin/env ts-node
/**
 * Step 6: Save bridge configuration to config/bridges/{env}.json
 *
 * Reads all values from .env and writes a complete BridgeConfig JSON
 * that the other packages (witness, sdk, app) can load.
 *
 * Run this AFTER all previous setup steps are complete.
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { Wallet } from "@transia/xrpl";
import type { BridgeConfig, WitnessConfig } from "@xbridge/config";

const ENV = process.env.XBRIDGE_ENV || "testnet";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
  return val;
}

async function main() {
  console.log(`\n=== XBridge: Save Config (${ENV}) ===\n`);

  const xahauDoor = requireEnv("XAHAU_DOOR_ADDRESS");
  const xrplDoor = requireEnv("XRPL_DOOR_ADDRESS");
  const currency = process.env.BRIDGE_CURRENCY || "XRP";
  const issuer = process.env.BRIDGE_ISSUER;
  const quorum = parseInt(process.env.BRIDGE_QUORUM || "2", 10);

  // Build witness list
  const witnesses: WitnessConfig[] = [];
  for (let i = 1; i <= 10; i++) {
    const seed = process.env[`WITNESS_${i}_SEED`];
    const xahauAddr = process.env[`WITNESS_${i}_XAHAU_ADDRESS`];
    const xrplAddr = process.env[`WITNESS_${i}_XRPL_ADDRESS`];

    if (seed && xahauAddr && xrplAddr) {
      const wallet = Wallet.fromSeed(seed);
      witnesses.push({
        name: `witness-${i}`,
        publicKey: wallet.publicKey,
        lockingChainAccount: xahauAddr,
        issuingChainAccount: xrplAddr,
      });
    }
  }

  if (witnesses.length === 0) {
    console.error("No witnesses found in .env. Need at least WITNESS_1_SEED.");
    process.exit(1);
  }

  // Build config
  const config: BridgeConfig = {
    name: `xbridge-${ENV}`,
    env: ENV as "testnet" | "mainnet",
    bridge: {
      LockingChainDoor: xahauDoor,
      LockingChainIssue:
        currency === "XRP" && !issuer
          ? { currency: "XRP" }
          : { currency, issuer: issuer! },
      IssuingChainDoor: xrplDoor,
      IssuingChainIssue:
        currency === "XRP" && !issuer
          ? { currency: "XRP" }
          : { currency, issuer: xrplDoor }, // door is issuer on XRPL side
      SignatureReward: "100",
      MinAccountCreateAmount: "10000000",
    },
    witnesses,
    quorum,
  };

  // Write to config/bridges/{env}.json
  const configDir = path.resolve(__dirname, "../../config/bridges");
  const configPath = path.join(configDir, `${ENV}.json`);

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`Config saved: ${configPath}`);
  console.log(JSON.stringify(config, null, 2));

  console.log(`\n✅ Bridge config saved. Witnesses: ${witnesses.length}, Quorum: ${quorum}`);
  console.log("The witness, sdk, and app packages can now load this config.");
}

main().catch(console.error);
