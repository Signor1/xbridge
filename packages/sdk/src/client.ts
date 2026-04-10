/**
 * XBridge SDK — High-level bridge client
 *
 * Usage:
 *   const bridge = new BridgeClient({ env: 'testnet', xahauDoor, xrplDoor });
 *   const tx = bridge.buildLockTransaction({ ... });
 *   // Submit tx via user's wallet (Crossmark, etc.)
 *   const status = await bridge.getTransferStatus(txHash);
 */

import {
  getChains,
  buildLockMemo,
  txUrl,
  type NetworkEnv,
  type ChainId,
  type ChainConfig,
} from "@xbridge/config";

export interface BridgeClientConfig {
  env: NetworkEnv;
  xahauDoor: string;
  xrplDoor: string;
}

export interface LockParams {
  /** Which chain to lock on */
  sourceChain: ChainId;
  /** User's address on the source chain */
  sender: string;
  /** User's address on the destination chain */
  destination: string;
  /** Amount in drops (native) or IOU value */
  amount: string;
}

export interface LockTransaction {
  TransactionType: string;
  Account: string;
  Destination: string;
  Amount: string;
  Memos: Array<{ Memo: { MemoType: string; MemoData: string } }>;
  NetworkID?: number;
}

export class BridgeClient {
  private env: NetworkEnv;
  private xahauDoor: string;
  private xrplDoor: string;

  constructor(config: BridgeClientConfig) {
    this.env = config.env;
    this.xahauDoor = config.xahauDoor;
    this.xrplDoor = config.xrplDoor;
  }

  /** Get chain configs */
  getChains() {
    return getChains(this.env);
  }

  /** Get door address for a chain */
  getDoorAddress(chain: ChainId): string {
    return chain === "xahau" ? this.xahauDoor : this.xrplDoor;
  }

  /** Get explorer URL for a tx */
  getTxUrl(chain: ChainId, hash: string): string {
    const chains = getChains(this.env);
    return txUrl(chains[chain], hash);
  }

  /**
   * Build a lock transaction that the user signs with their wallet.
   * This is a regular Payment to the door account with a bridge memo.
   */
  buildLockTransaction(params: LockParams): LockTransaction {
    const destChain: ChainId = params.sourceChain === "xahau" ? "xrpl" : "xahau";
    const doorAddress = this.getDoorAddress(params.sourceChain);

    const memo = buildLockMemo({
      destination: params.destination,
      sourceChain: params.sourceChain,
    });

    const chains = getChains(this.env);
    const sourceConfig = chains[params.sourceChain];

    const tx: LockTransaction = {
      TransactionType: "Payment",
      Account: params.sender,
      Destination: doorAddress,
      Amount: params.amount,
      Memos: [memo],
    };

    if (sourceConfig.networkId > 0) {
      tx.NetworkID = sourceConfig.networkId;
    }

    return tx;
  }
}
