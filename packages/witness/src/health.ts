/**
 * Health check HTTP endpoint
 */

import Fastify from "fastify";
import { getConnectionStatus } from "./listener";
import { getWitnessName } from "./config";

export async function startHealthServer(port: number) {
  const app = Fastify();

  app.get("/health", async () => {
    const connections = getConnectionStatus();
    const healthy = connections.xahau && connections.xrpl;

    return {
      status: healthy ? "ok" : "degraded",
      witness: getWitnessName(),
      connections,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  });

  await app.listen({ port, host: "0.0.0.0" });
}
