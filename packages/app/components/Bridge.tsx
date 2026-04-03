"use client";

import { useState } from "react";
import { ArrowDownUp, ExternalLink, Loader2, ArrowRight } from "lucide-react";
import type { BridgeDirection, NetworkEnv } from "@xbridge/sdk";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const CHAINS = {
  xahau: { name: "Xahau", abbr: "XAH", color: "bg-purple-500" },
  xrpl: { name: "XRPL", abbr: "XRP", color: "bg-primary" },
} as const;

type TransferState =
  | "idle"
  | "connecting"
  | "creating-claim"
  | "committing"
  | "attesting"
  | "completed"
  | "error";

export function Bridge({ network }: { network: NetworkEnv }) {
  const [direction, setDirection] = useState<BridgeDirection>("xahau-to-xrpl");
  const [amount, setAmount] = useState("");
  const [transferState, setTransferState] = useState<TransferState>("idle");
  const [attestations, setAttestations] = useState(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const from = direction === "xahau-to-xrpl" ? CHAINS.xahau : CHAINS.xrpl;
  const to = direction === "xahau-to-xrpl" ? CHAINS.xrpl : CHAINS.xahau;

  const toggleDirection = () => {
    setDirection((d) => (d === "xahau-to-xrpl" ? "xrpl-to-xahau" : "xahau-to-xrpl"));
    setError(null);
    setTransferState("idle");
  };

  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setError(null);
    setTransferState("connecting");

    // TODO: Wire up @xbridge/sdk + wallet connection
    setTimeout(() => {
      setTransferState("error");
      setError("Wallet connection not yet implemented — SDK integration pending");
    }, 1500);
  };

  const isProcessing = !["idle", "completed", "error"].includes(transferState);

  return (
    <Card className="overflow-hidden border-border/60 shadow-xl">
      <CardContent className="space-y-1 p-0">
        {/* ── From ── */}
        <div className="p-5 pb-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              From
            </span>
            <ChainPill name={from.name} abbr={from.abbr} color={from.color} />
          </div>
          <div className="flex items-end gap-3">
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isProcessing}
              className="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/40 disabled:opacity-50"
            />
            <span className="mb-1 whitespace-nowrap text-sm font-medium text-muted-foreground">
              {from.abbr}
            </span>
          </div>
        </div>

        {/* ── Direction toggle ── */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-x-0 h-px bg-border" />
          <button
            onClick={toggleDirection}
            disabled={isProcessing}
            className="relative z-10 flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition-all hover:scale-105 hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
          >
            <ArrowDownUp className="size-4" />
          </button>
        </div>

        {/* ── To ── */}
        <div className="p-5 pt-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              To
            </span>
            <ChainPill name={to.name} abbr={to.abbr} color={to.color} />
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-semibold tracking-tight text-muted-foreground/60">
              {amount || "0.00"}
            </span>
            <span className="mb-1 whitespace-nowrap text-sm font-medium text-muted-foreground">
              {to.abbr}
            </span>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="h-px bg-border" />

        {/* ── Bridge info ── */}
        <div className="flex items-center justify-between px-5 py-3 text-xs text-muted-foreground">
          <span>Bridge fee</span>
          <span className="font-mono">Free</span>
        </div>
        <div className="flex items-center justify-between px-5 pb-3 text-xs text-muted-foreground">
          <span>Estimated time</span>
          <span className="font-mono">~30s</span>
        </div>

        {/* ── Action ── */}
        <div className="p-5 pt-2">
          <Button
            onClick={handleBridge}
            disabled={!amount || parseFloat(amount) <= 0 || isProcessing}
            size="lg"
            className="w-full text-base"
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <BridgeStateLabel state={transferState} attestations={attestations} />
              </>
            ) : (
              <>
                Bridge
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>

        {/* ── Status ── */}
        {transferState !== "idle" && (
          <div className="border-t border-border px-5 py-4">
            <TransferStatus
              state={transferState}
              attestations={attestations}
              txHash={txHash}
              error={error}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChainPill({ name, abbr, color }: { name: string; abbr: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1">
      <div className={`size-2 rounded-full ${color}`} />
      <span className="text-xs font-semibold">{name}</span>
    </div>
  );
}

function BridgeStateLabel({
  state,
  attestations,
}: {
  state: string;
  attestations: number;
}) {
  switch (state) {
    case "connecting":
      return "Connecting...";
    case "creating-claim":
      return "Creating claim ID...";
    case "committing":
      return "Locking assets...";
    case "attesting":
      return `Witnessing (${attestations}/2)...`;
    default:
      return "Processing...";
  }
}

function TransferStatus({
  state,
  attestations,
  txHash,
  error,
}: {
  state: string;
  attestations: number;
  txHash: string | null;
  error: string | null;
}) {
  if (error) {
    return <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>;
  }

  if (state === "completed") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-success)]">
          <div className="size-2 rounded-full bg-[var(--color-success)]" />
          Transfer complete
        </div>
        {txHash && (
          <a
            href={`https://xahau-testnet.xrplwin.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            View on explorer <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Step
          label="Claim ID"
          active={state === "creating-claim"}
          done={["committing", "attesting", "completed"].includes(state)}
        />
        <Step
          label="Lock"
          active={state === "committing"}
          done={["attesting", "completed"].includes(state)}
        />
        <Step
          label={`Witness (${attestations}/2)`}
          active={state === "attesting"}
          done={state === "completed"}
        />
        <Step label="Release" active={false} done={state === "completed"} />
      </div>
    </div>
  );
}

function Step({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <div
        className={`flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors ${
          done
            ? "border-[var(--color-success)] bg-[var(--color-success)] text-white"
            : active
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground"
        }`}
      >
        {done ? "✓" : active ? <Loader2 className="size-3 animate-spin" /> : ""}
      </div>
      <span
        className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
      >
        {label}
      </span>
    </div>
  );
}
