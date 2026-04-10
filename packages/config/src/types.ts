/**
 * Core types for XBridge custom witness bridge
 */

// ── Chain & Network ──

export type NetworkEnv = "testnet" | "mainnet";
export type ChainId = "xahau" | "xrpl";

/** Token definition: native (XRP/XAH) or IOU */
export interface TokenIssue {
  currency: string;
  issuer?: string; // omit for native
}

// ── Bridge Configuration ──

export interface DoorConfig {
  address: string;
  /** Chain this door account lives on */
  chain: ChainId;
}

export interface WitnessConfig {
  name: string;
  publicKey: string;
  /** Account on Xahau (for signing multi-sig releases on Xahau) */
  xahauAccount: string;
  /** Account on XRPL (for signing multi-sig releases on XRPL) */
  xrplAccount: string;
  /** HTTP endpoint for peer communication */
  peerUrl: string;
}

export interface BridgeConfig {
  name: string;
  env: NetworkEnv;
  /** Door account on Xahau (locking chain) */
  xahauDoor: string;
  /** Door account on XRPL (issuing chain) */
  xrplDoor: string;
  /** Token being bridged */
  token: TokenIssue;
  /** Witness servers */
  witnesses: WitnessConfig[];
  /** Number of witness signatures required */
  quorum: number;
}

// ── Lock / Release Events ──

export interface LockEvent {
  /** Hash of the lock Payment transaction */
  txHash: string;
  /** Which chain the lock happened on */
  sourceChain: ChainId;
  /** Destination chain */
  destChain: ChainId;
  /** Who sent the lock */
  sender: string;
  /** Where to deliver on the destination chain */
  destination: string;
  /** Amount in drops (native) or string (IOU) */
  amount: string;
  /** Currency */
  currency: string;
  /** Issuer (for IOUs) */
  issuer?: string;
  /** When the lock was detected */
  detectedAt: number;
}

export interface Attestation {
  /** The lock event this attests to */
  sourceTxHash: string;
  sourceChain: ChainId;
  amount: string;
  currency: string;
  destination: string;
  /** Which witness signed this */
  witnessAccount: string;
  witnessPublicKey: string;
  /** Ed25519 signature of the attestation message */
  signature: string;
  timestamp: number;
}

export interface ReleaseEvent {
  /** Hash of the release Payment transaction */
  txHash: string;
  /** The lock tx this release corresponds to */
  sourceTxHash: string;
  /** Chain the release was submitted on */
  chain: ChainId;
  /** Recipient */
  destination: string;
  amount: string;
  /** Number of witness attestations used */
  attestationCount: number;
  timestamp: number;
}

// ── Transfer Status ──

export type TransferStatus =
  | "pending"    // lock detected, waiting for attestations
  | "attesting"  // collecting witness signatures
  | "releasing"  // multi-signed release submitted
  | "completed"  // release confirmed
  | "failed";    // something went wrong

export interface Transfer {
  id: string;
  sourceChain: ChainId;
  destChain: ChainId;
  sender: string;
  destination: string;
  amount: string;
  currency: string;
  status: TransferStatus;
  lockTxHash: string;
  releaseTxHash?: string;
  attestations: number;
  requiredAttestations: number;
  lockExplorerUrl?: string;
  releaseExplorerUrl?: string;
  createdAt: string;
  completedAt?: string;
}
