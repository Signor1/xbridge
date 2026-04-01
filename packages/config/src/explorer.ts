/**
 * Explorer URL builders
 */

import type { ChainConfig } from "./chains";

/** Link to an account on the explorer */
export function accountUrl(chain: ChainConfig, address: string): string {
  return `${chain.explorer}/account/${address}`;
}

/** Link to a transaction on the explorer */
export function txUrl(chain: ChainConfig, hash: string): string {
  return `${chain.explorer}/tx/${hash}`;
}
