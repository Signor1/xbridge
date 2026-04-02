// SDK client
export { BridgeClient } from "./client";
export type {
  BridgeClientConfig,
  CreateClaimIdParams,
  CommitParams,
  ClaimStatus,
  TransferResult,
} from "./client";

// Re-export config types for convenience
export {
  getChains,
  accountUrl,
  txUrl,
  type NetworkEnv,
  type BridgeDefinition,
  type BridgeDirection,
  type ChainConfig,
  type ChainIssue,
  type TransferStatus,
  type Transfer,
  type BridgeConfig,
} from "@xbridge/config";
