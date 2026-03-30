/**
 * XBridge SDK — High-level bridge client
 *
 * Usage:
 *   const bridge = new BridgeClient({ env: 'testnet' });
 *   await bridge.connect();
 *   const claimId = await bridge.createClaimId({ ... });
 *   const commit = await bridge.commit({ ... });
 *   const status = await bridge.getTransferStatus(claimId);
 */

import { Client, Wallet } from "@transia/xrpl";
import {
  getChains,
  type NetworkEnv,
  type BridgeDefinition,
  type BridgeDirection,
  type TransferStatus,
} from "@xbridge/config";

export interface BridgeClientConfig {
  env: NetworkEnv;
  bridgeDefinition: BridgeDefinition;
}

export interface CreateClaimIdParams {
  wallet: Wallet;
  direction: BridgeDirection;
  otherChainSource: string;
}

export interface CommitParams {
  wallet: Wallet;
  direction: BridgeDirection;
  claimId: number;
  amount: string;
  destination: string;
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

  async connect() {
    const chains = getChains(this.env);
    this.xahauClient = new Client(chains.xahau.wss);
    this.xrplClient = new Client(chains.xrpl.wss);
    await Promise.all([this.xahauClient.connect(), this.xrplClient.connect()]);
  }

  async disconnect() {
    await Promise.all([this.xahauClient?.disconnect(), this.xrplClient?.disconnect()]);
  }

  private getDestClient(direction: BridgeDirection): Client {
    const client = direction === "xahau-to-xrpl" ? this.xrplClient : this.xahauClient;
    if (!client?.isConnected()) throw new Error("Not connected");
    return client;
  }

  private getSourceClient(direction: BridgeDirection): Client {
    const client = direction === "xahau-to-xrpl" ? this.xahauClient : this.xrplClient;
    if (!client?.isConnected()) throw new Error("Not connected");
    return client;
  }

  /**
   * Step 1: Create a claim ID on the destination chain
   */
  async createClaimId(params: CreateClaimIdParams): Promise<number> {
    const destClient = this.getDestClient(params.direction);
    const chains = getChains(this.env);
    const destChain =
      params.direction === "xahau-to-xrpl" ? chains.xrpl : chains.xahau;

    const tx: Record<string, unknown> = {
      TransactionType: "XChainCreateClaimID",
      Account: params.wallet.address,
      XChainBridge: this.bridge,
      SignatureReward: this.bridge.SignatureReward,
      OtherChainSource: params.otherChainSource,
    };

    if (destChain.networkId > 0) {
      tx.NetworkID = destChain.networkId;
    }

    const result = await destClient.submitAndWait(tx, {
      wallet: params.wallet,
      autofill: true,
    });

    // Extract claim ID from metadata
    const meta = (result.result as Record<string, unknown>).meta as Record<string, unknown>;
    const affectedNodes = meta?.AffectedNodes as Array<Record<string, unknown>>;

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
   * Step 2: Commit assets on the source chain
   */
  async commit(params: CommitParams): Promise<string> {
    const sourceClient = this.getSourceClient(params.direction);
    const chains = getChains(this.env);
    const sourceChain =
      params.direction === "xahau-to-xrpl" ? chains.xahau : chains.xrpl;

    const tx: Record<string, unknown> = {
      TransactionType: "XChainCommit",
      Account: params.wallet.address,
      XChainBridge: this.bridge,
      XChainClaimID: params.claimId,
      Amount: params.amount,
      OtherChainDestination: params.destination,
    };

    if (sourceChain.networkId > 0) {
      tx.NetworkID = sourceChain.networkId;
    }

    const result = await sourceClient.submitAndWait(tx, {
      wallet: params.wallet,
      autofill: true,
    });

    return (result.result as Record<string, unknown>).hash as string;
  }

  /**
   * Check the status of a claim ID on the destination chain
   */
  async getClaimStatus(
    direction: BridgeDirection,
    claimId: number,
  ): Promise<{ attestations: number; completed: boolean }> {
    const destClient = this.getDestClient(direction);

    // Query the XChainOwnedClaimID object
    // This is a simplified check — full implementation would parse attestation count
    try {
      const doorAccount =
        direction === "xahau-to-xrpl"
          ? this.bridge.IssuingChainDoor
          : this.bridge.LockingChainDoor;

      const result = await destClient.request({
        command: "account_objects",
        account: doorAccount,
        type: "xchain_owned_claim_id" as never,
      });

      const objects = (result.result as Record<string, unknown>).account_objects as Array<
        Record<string, unknown>
      >;

      for (const obj of objects || []) {
        if (obj.XChainClaimID === claimId) {
          const attestations = obj.XChainClaimAttestations as unknown[] | undefined;
          return {
            attestations: attestations?.length || 0,
            completed: false,
          };
        }
      }

      // Claim ID no longer exists — it was consumed (transfer completed)
      return { attestations: 0, completed: true };
    } catch {
      return { attestations: 0, completed: false };
    }
  }
}
