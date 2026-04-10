/**
 * Memo encoding/decoding for bridge lock and release transactions.
 *
 * Lock memo: tells the bridge where to deliver on the other chain.
 * Release memo: references the source lock transaction for traceability.
 */

import type { ChainId } from "./types";

export const MEMO_TYPE_LOCK = "xbridge/lock";
export const MEMO_TYPE_RELEASE = "xbridge/release";

export interface LockMemoData {
  destination: string;
  sourceChain: ChainId;
}

export interface ReleaseMemoData {
  sourceTxHash: string;
  sourceChain: ChainId;
}

/** Encode a string to hex (for XRPL Memo fields) */
export function toHex(str: string): string {
  return Buffer.from(str, "utf8").toString("hex").toUpperCase();
}

/** Decode hex to string */
export function fromHex(hex: string): string {
  return Buffer.from(hex, "hex").toString("utf8");
}

/** Build a lock memo for a Payment transaction */
export function buildLockMemo(data: LockMemoData) {
  return {
    Memo: {
      MemoType: toHex(MEMO_TYPE_LOCK),
      MemoData: toHex(JSON.stringify(data)),
    },
  };
}

/** Build a release memo for a Payment transaction */
export function buildReleaseMemo(data: ReleaseMemoData) {
  return {
    Memo: {
      MemoType: toHex(MEMO_TYPE_RELEASE),
      MemoData: toHex(JSON.stringify(data)),
    },
  };
}

/** Parse a memo from a transaction. Returns null if not a bridge memo. */
export function parseMemo(
  memo: { Memo: { MemoType?: string; MemoData?: string } },
): { type: "lock"; data: LockMemoData } | { type: "release"; data: ReleaseMemoData } | null {
  try {
    const memoType = memo.Memo.MemoType ? fromHex(memo.Memo.MemoType) : "";
    const memoData = memo.Memo.MemoData ? fromHex(memo.Memo.MemoData) : "";

    if (memoType === MEMO_TYPE_LOCK) {
      return { type: "lock", data: JSON.parse(memoData) as LockMemoData };
    }
    if (memoType === MEMO_TYPE_RELEASE) {
      return { type: "release", data: JSON.parse(memoData) as ReleaseMemoData };
    }
    return null;
  } catch {
    return null;
  }
}
