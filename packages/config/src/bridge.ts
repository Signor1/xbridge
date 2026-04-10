/**
 * Bridge configuration helpers
 */

import type { BridgeConfig, TokenIssue } from "./types";

/** Create a native currency issue (XRP/XAH) */
export function nativeToken(): TokenIssue {
  return { currency: "XRP" };
}

/** Create an IOU token issue */
export function iouToken(currency: string, issuer: string): TokenIssue {
  return { currency, issuer };
}

/** Check if a token is native (XRP/XAH) */
export function isNativeToken(token: TokenIssue): boolean {
  return token.currency === "XRP" && !token.issuer;
}

/** Validate a bridge config and return errors */
export function validateBridgeConfig(config: BridgeConfig): string[] {
  const errors: string[] = [];

  if (!config.xahauDoor) errors.push("xahauDoor is empty");
  else if (!config.xahauDoor.startsWith("r")) errors.push("xahauDoor must start with 'r'");

  if (!config.xrplDoor) errors.push("xrplDoor is empty");
  else if (!config.xrplDoor.startsWith("r")) errors.push("xrplDoor must start with 'r'");

  if (!config.token?.currency) errors.push("token.currency is required");

  if (config.witnesses.length === 0) errors.push("No witnesses configured");
  if (config.quorum < 1) errors.push("Quorum must be at least 1");
  if (config.quorum > config.witnesses.length) {
    errors.push(`Quorum (${config.quorum}) exceeds witness count (${config.witnesses.length})`);
  }

  for (let i = 0; i < config.witnesses.length; i++) {
    const w = config.witnesses[i]!;
    if (!w.publicKey) errors.push(`Witness ${i} missing publicKey`);
    if (!w.xahauAccount) errors.push(`Witness ${i} missing xahauAccount`);
    if (!w.xrplAccount) errors.push(`Witness ${i} missing xrplAccount`);
    if (!w.peerUrl) errors.push(`Witness ${i} missing peerUrl`);
  }

  return errors;
}
