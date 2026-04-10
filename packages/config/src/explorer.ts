/**
 * Explorer URL builders
 */

import type { ChainConfig } from "./chains";

export function accountUrl(chain: ChainConfig, address: string): string {
  return `${chain.explorer}/account/${address}`;
}

export function txUrl(chain: ChainConfig, hash: string): string {
  // XRPL explorers use /transactions/, Xahau xrplwin uses /tx/
  const path = chain.explorer.includes("xrplwin") ? "tx" : "transactions";
  return `${chain.explorer}/${path}/${hash}`;
}
