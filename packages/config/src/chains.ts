/**
 * Chain definitions for Xahau and XRPL networks
 */

export interface ChainConfig {
  name: string;
  networkId: number;
  wss: string;
  rpc?: string;
  explorer: string;
  faucet?: string;
}

export const XAHAU_MAINNET: ChainConfig = {
  name: "Xahau Mainnet",
  networkId: 21337,
  wss: "wss://xahau.network",
  explorer: "https://xahau.xrplwin.com",
};

export const XAHAU_TESTNET: ChainConfig = {
  name: "Xahau Testnet",
  networkId: 21338,
  wss: "wss://xahau-test.net",
  explorer: "https://xahau-testnet.xrplwin.com",
  faucet: "https://xahau-test.net/accounts", // POST with optional { destination } to fund existing
};

export const XRPL_MAINNET: ChainConfig = {
  name: "XRPL Mainnet",
  networkId: 0,
  wss: "wss://xrplcluster.com",
  explorer: "https://livenet.xrpl.org",
};

export const XRPL_TESTNET: ChainConfig = {
  name: "XRPL Testnet",
  networkId: 1,
  wss: "wss://s.altnet.rippletest.net:51233",
  explorer: "https://testnet.xrpl.org",
  faucet: "https://faucet.altnet.rippletest.net/accounts", // POST with optional { destination } to fund existing
};

export type NetworkEnv = "testnet" | "mainnet";

export function getChains(env: NetworkEnv) {
  return {
    xahau: env === "mainnet" ? XAHAU_MAINNET : XAHAU_TESTNET,
    xrpl: env === "mainnet" ? XRPL_MAINNET : XRPL_TESTNET,
  };
}
