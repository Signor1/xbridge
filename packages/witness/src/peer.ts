/**
 * Peer-to-peer communication between witness servers.
 * Simple HTTP POST — no message broker needed.
 */

import type { Attestation } from "@xbridge/config";
import { getPeerUrls, getWitnessName } from "./config";
import { saveAttestation, getAttestationCount } from "./db";

/**
 * Broadcast an attestation to all peer witnesses
 */
export async function broadcastAttestation(attestation: Attestation) {
  const peers = getPeerUrls();
  const name = getWitnessName();

  for (const peerUrl of peers) {
    try {
      const res = await fetch(`${peerUrl}/attestation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attestation),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        console.warn(`  [${name}] Peer ${peerUrl}: ${res.status}`);
      }
    } catch {
      // Peer might be down — that's ok, they'll catch up
    }
  }
}

/**
 * Handle an incoming attestation from a peer witness.
 * Returns the new attestation count for this source tx.
 */
export function receiveAttestation(attestation: Attestation): number {
  saveAttestation(
    attestation.sourceTxHash,
    attestation.witnessAccount,
    attestation.witnessPublicKey,
    attestation.signature,
  );

  return getAttestationCount(attestation.sourceTxHash);
}
