/**
 * Core types for XBridge
 */

/** Token issue on a chain (currency + issuer, or native XRP/XAH) */
export interface ChainIssue {
  currency: string;
  issuer?: string; // omit for native XRP/XAH
}

/** Bridge definition matching the XChainBridge ledger object */
export interface BridgeDefinition {
  LockingChainDoor: string;
  LockingChainIssue: ChainIssue;
  IssuingChainDoor: string;
  IssuingChainIssue: ChainIssue;
  SignatureReward: string; // drops
  MinAccountCreateAmount: string; // drops
}

/** Witness server identity */
export interface WitnessConfig {
  name: string;
  /** Witness signing public key (Ed25519) */
  publicKey: string;
  /** Account on the locking chain (Xahau) */
  lockingChainAccount: string;
  /** Account on the issuing chain (XRPL) */
  issuingChainAccount: string;
}

/** Full bridge configuration */
export interface BridgeConfig {
  name: string;
  env: "testnet" | "mainnet";
  bridge: BridgeDefinition;
  witnesses: WitnessConfig[];
  quorum: number; // e.g. 2 for 2-of-3
}

/** Transfer direction */
export type BridgeDirection = "xahau-to-xrpl" | "xrpl-to-xahau";

/** Transfer status */
export type TransferStatus =
  | "pending" // claim ID created, waiting for commit
  | "committed" // assets locked in source door
  | "attesting" // witnesses are submitting attestations
  | "completed" // assets released on destination
  | "failed"; // something went wrong

/** A cross-chain transfer record */
export interface Transfer {
  id: string;
  direction: BridgeDirection;
  claimId: number;
  amount: string;
  currency: string;
  sourceAddress: string;
  destinationAddress: string;
  status: TransferStatus;
  attestations: number;
  requiredAttestations: number;
  sourceTxHash?: string;
  destinationTxHash?: string;
  createdAt: string;
  completedAt?: string;
}
