export { BridgeClient } from "./client";
export type { BridgeClientConfig, LockParams, LockTransaction } from "./client";

// Re-export config types
export {
  getChains,
  getOtherChain,
  buildLockMemo,
  parseMemo,
  txUrl,
  accountUrl,
  nativeToken,
  iouToken,
  isNativeToken,
  computeAttestationHash,
  type NetworkEnv,
  type ChainId,
  type ChainConfig,
  type TokenIssue,
  type BridgeConfig,
  type LockEvent,
  type Attestation,
  type ReleaseEvent,
  type Transfer,
  type TransferStatus,
} from "@xbridge/config";
