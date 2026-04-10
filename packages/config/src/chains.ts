/**
 * Chain definitions for Xahau and XRPL networks
 */

import type { NetworkEnv, ChainId } from "./types";

export interface ChainConfig {
  id: ChainId;
  name: string;
  networkId: number;
  wss: string;
  explorer: string;
  faucet?: string;
  /** Xahau requires apiVersion 1 — XRPL uses 2 */
  apiVersion: number;
  /** Only Xahau requires NetworkID in transactions */
  requiresNetworkId: boolean;
}

export const XAHAU_MAINNET: ChainConfig = {
  id: "xahau",
  name: "Xahau Mainnet",
  networkId: 21337,
  wss: "wss://xahau.network",
  explorer: "https://xahau.xrplwin.com",
  apiVersion: 1,
  requiresNetworkId: true,
};

export const XAHAU_TESTNET: ChainConfig = {
  id: "xahau",
  name: "Xahau Testnet",
  networkId: 21338,
  wss: "wss://xahau-test.net",
  explorer: "https://xahau-testnet.xrplwin.com",
  faucet: "https://xahau-test.net/accounts",
  apiVersion: 1,
  requiresNetworkId: true,
};

export const XRPL_MAINNET: ChainConfig = {
  id: "xrpl",
  name: "XRPL Mainnet",
  networkId: 0,
  wss: "wss://xrplcluster.com",
  explorer: "https://livenet.xrpl.org",
  apiVersion: 2,
  requiresNetworkId: false,
};

export const XRPL_TESTNET: ChainConfig = {
  id: "xrpl",
  name: "XRPL Testnet",
  networkId: 1,
  wss: "wss://s.altnet.rippletest.net:51233",
  explorer: "https://testnet.xrpl.org",
  faucet: "https://faucet.altnet.rippletest.net/accounts",
  apiVersion: 2,
  requiresNetworkId: false,
};

export function getChains(env: NetworkEnv) {
  return {
    xahau: env === "mainnet" ? XAHAU_MAINNET : XAHAU_TESTNET,
    xrpl: env === "mainnet" ? XRPL_MAINNET : XRPL_TESTNET,
  };
}

export function getChainConfig(env: NetworkEnv, chain: ChainId): ChainConfig {
  return getChains(env)[chain];
}

export function getOtherChain(chain: ChainId): ChainId {
  return chain === "xahau" ? "xrpl" : "xahau";
}
