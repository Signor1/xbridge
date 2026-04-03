"use client";

import { Circle, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { NetworkEnv } from "@xbridge/sdk";

const NETWORKS: Record<NetworkEnv, { label: string; color: string }> = {
  testnet: { label: "Testnet", color: "var(--color-warning)" },
  mainnet: { label: "Mainnet", color: "var(--color-success)" },
};

export function NetworkBadge({
  network,
  onChange,
}: {
  network: NetworkEnv;
  onChange: (env: NetworkEnv) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = NETWORKS[network];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-secondary"
      >
        <Circle className="size-2" style={{ fill: current.color, color: current.color }} />
        {current.label}
        <ChevronDown className="size-3" />
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-1.5 w-36 -translate-x-1/2 rounded-lg border border-border bg-card p-1 shadow-lg">
          {(Object.keys(NETWORKS) as NetworkEnv[]).map((env) => {
            const n = NETWORKS[env];
            const isActive = env === network;
            return (
              <button
                key={env}
                onClick={() => {
                  onChange(env);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <Circle className="size-2" style={{ fill: n.color, color: n.color }} />
                {n.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
