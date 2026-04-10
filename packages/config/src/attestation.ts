/**
 * Attestation message construction and verification.
 *
 * Witnesses sign a deterministic message derived from the lock event.
 * This message is the same regardless of which witness computes it,
 * ensuring all signatures attest to the same data.
 */

import * as crypto from "crypto";
import { ATTESTATION_PREFIX } from "./constants";
import type { ChainId } from "./types";

export interface AttestationMessage {
  sourceTxHash: string;
  sourceChain: ChainId;
  amount: string;
  currency: string;
  issuer?: string;
  destination: string;
}

/**
 * Compute the canonical hash of an attestation message.
 * All witnesses must produce the same hash for the same lock event.
 */
export function computeAttestationHash(msg: AttestationMessage): string {
  const payload = [
    ATTESTATION_PREFIX,
    msg.sourceTxHash,
    msg.sourceChain,
    msg.amount,
    msg.currency,
    msg.issuer || "",
    msg.destination,
  ].join("|");

  return crypto.createHash("sha256").update(payload).digest("hex");
}
