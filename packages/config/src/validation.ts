/**
 * Validate bridge configuration completeness
 */

import type { BridgeConfig } from "./types";

/**
 * Validate a BridgeConfig and return a list of errors.
 * Empty array = valid.
 */
export function validateBridgeConfig(config: BridgeConfig): string[] {
  const errors: string[] = [];

  // Bridge definition
  if (!config.bridge.LockingChainDoor) {
    errors.push("LockingChainDoor is empty — run setup scripts first");
  } else if (!config.bridge.LockingChainDoor.startsWith("r")) {
    errors.push("LockingChainDoor must be a valid XRPL/Xahau address starting with 'r'");
  }

  if (!config.bridge.IssuingChainDoor) {
    errors.push("IssuingChainDoor is empty — run setup scripts first");
  } else if (!config.bridge.IssuingChainDoor.startsWith("r")) {
    errors.push("IssuingChainDoor must be a valid XRPL/Xahau address starting with 'r'");
  }

  if (!config.bridge.LockingChainIssue?.currency) {
    errors.push("LockingChainIssue.currency is required");
  }

  if (!config.bridge.IssuingChainIssue?.currency) {
    errors.push("IssuingChainIssue.currency is required");
  }

  // Witnesses
  if (config.witnesses.length === 0) {
    errors.push("No witnesses configured — need at least 1 for testnet, 3 for mainnet");
  }

  if (config.quorum < 1) {
    errors.push("Quorum must be at least 1");
  }

  if (config.quorum > config.witnesses.length) {
    errors.push(
      `Quorum (${config.quorum}) exceeds witness count (${config.witnesses.length})`,
    );
  }

  for (let i = 0; i < config.witnesses.length; i++) {
    const w = config.witnesses[i]!;
    if (!w.publicKey) {
      errors.push(`Witness ${i} (${w.name}) is missing publicKey`);
    }
    if (!w.lockingChainAccount) {
      errors.push(`Witness ${i} (${w.name}) is missing lockingChainAccount`);
    }
    if (!w.issuingChainAccount) {
      errors.push(`Witness ${i} (${w.name}) is missing issuingChainAccount`);
    }
  }

  return errors;
}
