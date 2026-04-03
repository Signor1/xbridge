"use client";

import { useState } from "react";
import type { NetworkEnv } from "@xbridge/sdk";
import { Bridge } from "./bridge";
import { Header } from "./header";
import { NetworkBadge } from "./network-badge";

export function BridgePage() {
  const [network, setNetwork] = useState<NetworkEnv>("testnet");

  return (
    <div className="relative min-h-screen">
      {/* Background gradient */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-primary)/8%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,var(--color-accent)/5%,transparent_50%)]" />
      </div>

      <Header />

      <main className="flex flex-col items-center px-4 pb-16 pt-8">
        <div className="mb-6">
          <NetworkBadge network={network} onChange={setNetwork} />
        </div>

        <div className="w-full max-w-[480px]">
          <Bridge network={network} />
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <a
            href="https://xrpl.org/docs/concepts/xrpl-sidechains/cross-chain-bridges"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            XChainBridge (XLS-38d)
          </a>
        </p>
      </main>
    </div>
  );
}
