/**
 * Health check HTTP endpoint
 */

import Fastify from "fastify";

const WITNESS_NAME = process.env.WITNESS_NAME || "witness";

export async function startHealthServer(port: number) {
  const app = Fastify();

  app.get("/health", async () => ({
    status: "ok",
    witness: WITNESS_NAME,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  await app.listen({ port, host: "0.0.0.0" });
}
