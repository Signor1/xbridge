/**
 * XBridge SDK — High-level bridge client
 *
 * Usage:
 *   const bridge = new BridgeClient({ env: 'testnet', bridgeDefinition });
 *   await bridge.connect();
 *
 *   // Step 1: Create claim ID on destination
 *   const claimId = await bridge.createClaimId({ ... });
 *
 *   // Step 2: Commit (lock) assets on source
 *   const txHash = await bridge.commit({ ... });
 *
 *   // Step 3: Wait for witnesses + auto-release
 *   const result = await bridge.waitForCompletion('xahau-to-xrpl', claimId);
 */

import { Client, Wallet } from "@transia/xrpl";
import {
  getChains,
  accountUrl,
  txUrl,
  type NetworkEnv,
  type BridgeDefinition,
  type BridgeDirection,
  type ChainConfig,
} from "@xbridge/config";

export interface BridgeClientConfig {
  env: NetworkEnv;
  bridgeDefinition: BridgeDefinition;
}

export interface CreateClaimIdParams {
  wallet: Wallet;
  direction: BridgeDirection;
  /** The user's address on the OTHER chain (source side) */
  otherChainSource: string;
}

export interface CommitParams {
  wallet: Wallet;
  direction: BridgeDirection;
  claimId: number;
  /** Amount in drops (native) or IOU string */
  amount: string;
  /** The user's address on the OTHER chain (destination side) */
  destination: string;
}

export interface ClaimStatus {
  exists: boolean;
  attestations: number;
  completed: boolean;
}

export interface TransferResult {
  claimId: number;
  commitTxHash: string;
  commitExplorerUrl: string;
  completed: boolean;
  attestations: number;
}

export class BridgeClient {
  private env: NetworkEnv;
  private bridge: BridgeDefinition;
  private xahauClient: Client | null = null;
  private xrplClient: Client | null = null;

  constructor(config: BridgeClientConfig) {
    this.env = config.env;
    this.bridge = config.bridgeDefinition;
  }

  /** Connect to both chains */
  async connect() {
    const chains = getChains(this.env);
    this.xahauClient = new Client(chains.xahau.wss);
    this.xrplClient = new Client(chains.xrpl.wss);
    await Promise.all([this.xahauClient.connect(), this.xrplClient.connect()]);
  }

  /** Disconnect from both chains */
  async disconnect() {
    await Promise.all([this.xahauClient?.disconnect(), this.xrplClient?.disconnect()]);
  }

  /** Check if connected to both chains */
  isConnected(): boolean {
    return (this.xahauClient?.isConnected() ?? false) && (this.xrplClient?.isConnected() ?? false);
  }

  /** Get the chain config for a direction */
  private getChainConfigs(direction: BridgeDirection) {
    const chains = getChains(this.env);
    return direction === "xahau-to-xrpl"
      ? { source: chains.xahau, dest: chains.xrpl }
      : { source: chains.xrpl, dest: chains.xahau };
  }

  private getDestClient(direction: BridgeDirection): Client {
    const client = direction === "xahau-to-xrpl" ? this.xrplClient : this.xahauClient;
    if (!client?.isConnected()) throw new Error("Not connected to destination chain");
    return client;
  }

  private getSourceClient(direction: BridgeDirection): Client {
    const client = direction === "xahau-to-xrpl" ? this.xahauClient : this.xrplClient;
    if (!client?.isConnected()) throw new Error("Not connected to source chain");
    return client;
  }

  /** Get the bridge definition (for the UI to display) */
  getBridgeDefinition(): BridgeDefinition {
    return this.bridge;
  }

  /**
   * Get balance on a specific chain
   */
  async getBalance(chain: "xahau" | "xrpl", address: string): Promise<string> {
    const client = chain === "xahau" ? this.xahauClient : this.xrplClient;
    if (!client?.isConnected()) throw new Error(`Not connected to ${chain}`);

    try {
      return await client.getXrpBalance(address);
    } catch {
      return "0";
    }
  }

  /**
   * Get explorer URLs for an address on both chains
   */
  getExplorerUrls(xahauAddress: string, xrplAddress: string) {
    const chains = getChains(this.env);
    return {
      xahau: accountUrl(chains.xahau, xahauAddress),
      xrpl: accountUrl(chains.xrpl, xrplAddress),
    };
  }

  /**
   * Get explorer URL for a transaction
   */
  getTxExplorerUrl(chain: "xahau" | "xrpl", hash: string): string {
    const chains = getChains(this.env);
    return txUrl(chain === "xahau" ? chains.xahau : chains.xrpl, hash);
  }

  /**
   * Step 1: Create a claim ID on the destination chain
   *
   * This reserves a slot for the incoming transfer. The returned claimId
   * is needed for the commit step.
   */
  async createClaimId(params: CreateClaimIdParams): Promise<number> {
    const destClient = this.getDestClient(params.direction);
    const { dest } = this.getChainConfigs(params.direction);

    const tx: Record<string, unknown> = {
      TransactionType: "XChainCreateClaimID",
      Account: params.wallet.address,
      XChainBridge: this.bridgeObj(),
      SignatureReward: this.bridge.SignatureReward,
      OtherChainSource: params.otherChainSource,
    };

    if (dest.networkId > 0) {
      tx.NetworkID = dest.networkId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await destClient.submitAndWait(tx as any, {
      wallet: params.wallet,
      autofill: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (result.result as any).meta;
    const affectedNodes = meta?.AffectedNodes as Array<Record<string, unknown>> | undefined;

    for (const node of affectedNodes || []) {
      const created = node.CreatedNode as Record<string, unknown> | undefined;
      if (created?.LedgerEntryType === "XChainOwnedClaimID") {
        const fields = created.NewFields as Record<string, unknown>;
        return fields.XChainClaimID as number;
      }
    }

    throw new Error("Failed to extract claim ID from transaction metadata");
  }

  /**
   * Step 2: Commit (lock) assets on the source chain
   *
   * After this, witnesses will detect the commit and submit attestations
   * on the destination chain. Once quorum is reached, assets are auto-released.
   */
  async commit(params: CommitParams): Promise<TransferResult> {
    const sourceClient = this.getSourceClient(params.direction);
    const { source } = this.getChainConfigs(params.direction);

    const tx: Record<string, unknown> = {
      TransactionType: "XChainCommit",
      Account: params.wallet.address,
      XChainBridge: this.bridgeObj(),
      XChainClaimID: params.claimId,
      Amount: params.amount,
      OtherChainDestination: params.destination,
    };

    if (source.networkId > 0) {
      tx.NetworkID = source.networkId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sourceClient.submitAndWait(tx as any, {
      wallet: params.wallet,
      autofill: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = (result.result as any).hash as string;
    const sourceChain = params.direction === "xahau-to-xrpl" ? "xahau" : "xrpl";

    return {
      claimId: params.claimId,
      commitTxHash: hash,
      commitExplorerUrl: this.getTxExplorerUrl(sourceChain, hash),
      completed: false,
      attestations: 0,
    };
  }

  /**
   * Check the status of a claim ID on the destination chain
   *
   * - exists: true if the claim object is still on the ledger (transfer in progress)
   * - attestations: number of witness attestations received so far
   * - completed: true if the claim was consumed (assets released)
   */
  async getClaimStatus(direction: BridgeDirection, claimId: number): Promise<ClaimStatus> {
    const destClient = this.getDestClient(direction);

    try {
      const doorAccount =
        direction === "xahau-to-xrpl"
          ? this.bridge.IssuingChainDoor
          : this.bridge.LockingChainDoor;

      const result = await destClient.request({
        command: "account_objects",
        account: doorAccount,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: "xchain_owned_claim_id" as any,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const objects = (result.result as any).account_objects as Array<Record<string, unknown>>;

      for (const obj of objects || []) {
        if (obj.XChainClaimID === claimId) {
          const attestations = obj.XChainClaimAttestations as unknown[] | undefined;
          return {
            exists: true,
            attestations: attestations?.length || 0,
            completed: false,
          };
        }
      }

      // Claim ID gone = consumed = transfer done
      return { exists: false, attestations: 0, completed: true };
    } catch {
      return { exists: false, attestations: 0, completed: false };
    }
  }

  /**
   * Poll until the transfer completes (claim consumed) or timeout
   *
   * @param direction - Bridge direction
   * @param claimId - Claim ID from createClaimId
   * @param pollIntervalMs - How often to check (default 5s)
   * @param timeoutMs - Max wait time (default 5 minutes)
   * @param onStatusChange - Callback on each poll (for UI updates)
   */
  async waitForCompletion(
    direction: BridgeDirection,
    claimId: number,
    options?: {
      pollIntervalMs?: number;
      timeoutMs?: number;
      onStatusChange?: (status: ClaimStatus) => void;
    },
  ): Promise<ClaimStatus> {
    const pollInterval = options?.pollIntervalMs || 5000;
    const timeout = options?.timeoutMs || 5 * 60 * 1000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getClaimStatus(direction, claimId);

      if (options?.onStatusChange) {
        options.onStatusChange(status);
      }

      if (status.completed) {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // Timed out
    const finalStatus = await this.getClaimStatus(direction, claimId);
    return finalStatus;
  }

  /**
   * Build the bridge object for transactions (without SignatureReward/MinAccountCreateAmount)
   */
  private bridgeObj() {
    return {
      LockingChainDoor: this.bridge.LockingChainDoor,
      LockingChainIssue: this.bridge.LockingChainIssue,
      IssuingChainDoor: this.bridge.IssuingChainDoor,
      IssuingChainIssue: this.bridge.IssuingChainIssue,
    };
  }
}
