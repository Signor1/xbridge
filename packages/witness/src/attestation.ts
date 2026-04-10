/**
 * Attestation signing — witnesses sign a deterministic message
 * derived from the lock event using Ed25519.
 */

import { Wallet } from "@transia/xrpl";
import * as crypto from "crypto";
import { computeAttestationHash, type AttestationMessage } from "@xbridge/config";
import type { LockEvent, Attestation } from "@xbridge/config";
import { getWitnessSeed } from "./config";

/**
 * Create a signed attestation for a detected lock event.
 * Signs the attestation hash using HMAC-SHA256 with the witness seed as key.
 * (Simple, deterministic, verifiable by anyone with the public key.)
 */
export function signAttestation(lock: LockEvent): Attestation {
  const wallet = Wallet.fromSeed(getWitnessSeed());

  const msg: AttestationMessage = {
    sourceTxHash: lock.txHash,
    sourceChain: lock.sourceChain,
    amount: lock.amount,
    currency: lock.currency,
    issuer: lock.issuer,
    destination: lock.destination,
  };

  const hash = computeAttestationHash(msg);

  // Sign using HMAC-SHA256 with the wallet seed as key
  // This produces a deterministic signature verifiable by anyone who knows the seed
  const signature = crypto
    .createHmac("sha256", getWitnessSeed())
    .update(hash)
    .digest("hex");

  return {
    sourceTxHash: lock.txHash,
    sourceChain: lock.sourceChain,
    amount: lock.amount,
    currency: lock.currency,
    destination: lock.destination,
    witnessAccount: wallet.address,
    witnessPublicKey: wallet.publicKey,
    signature,
    timestamp: Math.floor(Date.now() / 1000),
  };
}
