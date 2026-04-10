/**
 * HTTP server for health checks and peer attestation exchange
 */

import Fastify from "fastify";
import type { Attestation } from "@xbridge/config";
import { getConnectionStatus } from "./listener";
import { getWitnessName } from "./config";
import { receiveAttestation } from "./peer";
import { getAttestationCount } from "./db";

export async function startServer(port: number) {
  const app = Fastify();

  /** Health check */
  app.get("/health", async () => {
    const connections = getConnectionStatus();
    return {
      status: connections.xahau && connections.xrpl ? "ok" : "degraded",
      witness: getWitnessName(),
      connections,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  });

  /** Receive attestation from peer */
  app.post("/attestation", async (request, reply) => {
    const attestation = request.body as Attestation;

    if (!attestation?.sourceTxHash || !attestation?.witnessAccount || !attestation?.signature) {
      return reply.status(400).send({ error: "Invalid attestation" });
    }

    const count = receiveAttestation(attestation);
    return { received: true, attestationCount: count };
  });

  /** Query attestation count for a lock */
  app.get("/attestations/:txHash", async (request) => {
    const { txHash } = request.params as { txHash: string };
    return { txHash, count: getAttestationCount(txHash) };
  });

  await app.listen({ port, host: "0.0.0.0" });
}
