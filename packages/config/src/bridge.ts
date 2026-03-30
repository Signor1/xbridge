/**
 * Bridge definition helpers
 */

import type { BridgeDefinition, ChainIssue } from "./types";

/**
 * Build a BridgeDefinition object for XChainCreateBridge transactions.
 * The same definition must be submitted on both chains.
 */
export function createBridgeDefinition(params: {
  lockingDoor: string;
  lockingIssue: ChainIssue;
  issuingDoor: string;
  issuingIssue: ChainIssue;
  signatureReward?: string;
  minAccountCreateAmount?: string;
}): BridgeDefinition {
  return {
    LockingChainDoor: params.lockingDoor,
    LockingChainIssue: params.lockingIssue,
    IssuingChainDoor: params.issuingDoor,
    IssuingChainIssue: params.issuingIssue,
    SignatureReward: params.signatureReward || "100",
    MinAccountCreateAmount: params.minAccountCreateAmount || "10000000",
  };
}

/**
 * Create a native currency issue (XRP or XAH — represented as {"currency": "XRP"} with no issuer)
 */
export function nativeIssue(): ChainIssue {
  return { currency: "XRP" };
}

/**
 * Create an IOU issue
 */
export function iouIssue(currency: string, issuer: string): ChainIssue {
  return { currency, issuer };
}
