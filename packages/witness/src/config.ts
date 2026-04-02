/**
 * Witness configuration — loads bridge definition and env settings
 */

import { getChains, type NetworkEnv, type BridgeDefinition, type ChainIssue } from "@xbridge/config";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

export function getEnv(): NetworkEnv {
  return ENV;
}

export function getWitnessName(): string {
  return process.env.WITNESS_NAME || "witness-unknown";
}

export function getWitnessSeed(): string {
  const seed = process.env.WITNESS_SEED;
  if (!seed) throw new Error("WITNESS_SEED not set in .env");
  return seed;
}

export function getDoorAddresses() {
  const xahauDoor = process.env.XAHAU_DOOR_ADDRESS;
  const xrplDoor = process.env.XRPL_DOOR_ADDRESS;
  if (!xahauDoor || !xrplDoor) {
    throw new Error("Missing XAHAU_DOOR_ADDRESS or XRPL_DOOR_ADDRESS in .env");
  }
  return { xahauDoor, xrplDoor };
}

export function getBridgeIssue(): { locking: ChainIssue; issuing: ChainIssue } {
  const currency = process.env.BRIDGE_CURRENCY || "XRP";
  const issuer = process.env.BRIDGE_ISSUER;
  const isNative = currency === "XRP" && !issuer;
  const { xrplDoor } = getDoorAddresses();

  return {
    locking: isNative ? { currency: "XRP" } : { currency, issuer: issuer! },
    issuing: isNative ? { currency: "XRP" } : { currency, issuer: xrplDoor },
  };
}

export function getBridgeDefinition(): BridgeDefinition {
  const { xahauDoor, xrplDoor } = getDoorAddresses();
  const issue = getBridgeIssue();

  return {
    LockingChainDoor: xahauDoor,
    LockingChainIssue: issue.locking,
    IssuingChainDoor: xrplDoor,
    IssuingChainIssue: issue.issuing,
    SignatureReward: "100",
    MinAccountCreateAmount: "10000000",
  };
}

export function getRetryConfig() {
  return {
    maxRetries: parseInt(process.env.MAX_ATTESTATION_RETRIES || "3", 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || "5000", 10),
  };
}

export { getChains };
