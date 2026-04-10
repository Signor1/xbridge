/**
 * Witness configuration from environment variables
 */

import {
  getChains,
  type NetworkEnv,
  type ChainId,
  type ChainConfig,
} from "@xbridge/config";

const ENV = (process.env.XBRIDGE_ENV || "testnet") as NetworkEnv;

export function getEnv(): NetworkEnv {
  return ENV;
}

export function getWitnessName(): string {
  return process.env.WITNESS_NAME || "witness-unknown";
}

export function getWitnessSeed(): string {
  const seed = process.env.WITNESS_SEED;
  if (!seed) throw new Error("WITNESS_SEED not set");
  return seed;
}

export function getDoors() {
  const xahau = process.env.XAHAU_DOOR_ADDRESS;
  const xrpl = process.env.XRPL_DOOR_ADDRESS;
  if (!xahau || !xrpl) throw new Error("Missing door addresses");
  return { xahau, xrpl };
}

export function getDoorAddress(chain: ChainId): string {
  const doors = getDoors();
  return chain === "xahau" ? doors.xahau : doors.xrpl;
}

export function getPeerUrls(): string[] {
  const urls: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const url = process.env[`PEER_${i}_URL`];
    if (url) urls.push(url);
  }
  return urls;
}

export function getQuorum(): number {
  return parseInt(process.env.BRIDGE_QUORUM || "2", 10);
}

export function getChainConfig(chain: ChainId): ChainConfig {
  return getChains(ENV)[chain];
}

export { getChains };
