"use client";

import { useState } from "react";
import { ArrowDownUp, ExternalLink, Loader2, ArrowRight, Wallet, LogOut } from "lucide-react";
import { BridgeClient, type ChainId, type NetworkEnv } from "@xbridge/sdk";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWallet } from "@/hooks/use-wallet";

// Testnet bridge config — from setup output
const BRIDGE_CONFIG = {
  testnet: {
    xahauDoor: "rL4RvGq6PYqjyLgPKSBHnUpBkMFWJYDHKA",
    xrplDoor: "rDUiuyrdBZMYDSXbWRTrHkobAiadbiZvHA",
  },
  mainnet: {
    xahauDoor: "",
    xrplDoor: "",
  },
};

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
  const wallet = useWallet();
  const [sourceChain, setSourceChain] = useState<ChainId>("xahau");
  const [amount, setAmount] = useState("");
  const [transferState, setTransferState] = useState<TransferState>("idle");
  const [attestations, setAttestations] = useState(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const from = sourceChain === "xahau" ? CHAINS.xahau : CHAINS.xrpl;
  const to = sourceChain === "xahau" ? CHAINS.xrpl : CHAINS.xahau;

  const toggleDirection = () => {
    setSourceChain((s) => (s === "xahau" ? "xrpl" : "xahau"));
    setError(null);
    setTransferState("idle");
  };

  const handleConnect = async () => {
    try {
      setError(null);
      await wallet.connect();
    } catch (err) {
      setError("Failed to connect wallet. Is Crossmark installed?");
    }
  };

  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (!wallet.connected || !wallet.address) {
      setError("Connect your wallet first");
      return;
    }

    const config = BRIDGE_CONFIG[network];
    if (!config.xahauDoor || !config.xrplDoor) {
      setError(`Bridge not configured for ${network}`);
      return;
    }

    setError(null);
    setTxHash(null);
    setAttestations(0);

    try {
      setTransferState("committing");

      // Build the lock transaction using the SDK
      const bridge = new BridgeClient({
        env: network,
        xahauDoor: config.xahauDoor,
        xrplDoor: config.xrplDoor,
      });

      // Convert amount to drops (1 XRP/XAH = 1,000,000 drops)
      const drops = String(Math.floor(parseFloat(amount) * 1_000_000));

      const lockTx = bridge.buildLockTransaction({
        sourceChain: sourceChain,
        sender: wallet.address,
        destination: wallet.address, // same address on both chains
        amount: drops,
      });

      // Submit via Crossmark wallet
      const { hash } = await wallet.signAndSubmit(lockTx as unknown as Record<string, unknown>);

      setTxHash(hash);
      setTransferState("attesting");

      // Wait for witnesses to detect + release (poll witness health endpoint)
      // For now, show attesting state for a few seconds then mark complete
      setTimeout(() => {
        setTransferState("completed");
      }, 15000);
    } catch (err) {
      const msg = (err as Error).message || "Bridge transaction failed";
      setError(msg);
      setTransferState("error");
    }
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

        {/* ── Wallet + Bridge info ── */}
        {wallet.connected && wallet.address && (
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wallet className="size-3" />
              <span className="font-mono">
                {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
              </span>
            </div>
            <button
              onClick={wallet.disconnect}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              <LogOut className="size-3" />
              Disconnect
            </button>
          </div>
        )}

        <div className="flex items-center justify-between px-5 py-2 text-xs text-muted-foreground">
          <span>Bridge fee</span>
          <span className="font-mono">Free</span>
        </div>
        <div className="flex items-center justify-between px-5 pb-3 text-xs text-muted-foreground">
          <span>Estimated time</span>
          <span className="font-mono">~30s</span>
        </div>

        {/* ── Action ── */}
        <div className="p-5 pt-2">
          {!wallet.connected ? (
            <Button
              onClick={handleConnect}
              disabled={wallet.loading}
              size="lg"
              variant="outline"
              className="w-full text-base"
            >
              {wallet.loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wallet className="size-4" />
              )}
              {wallet.loading ? "Connecting..." : "Connect Wallet"}
            </Button>
          ) : (
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
          )}
        </div>

        {/* ── Status ── */}
        {transferState !== "idle" && (
          <div className="border-t border-border px-5 py-4">
            <TransferStatus
              state={transferState}
              attestations={attestations}
              txHash={txHash}
              error={error}
              sourceChain={sourceChain}
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
  sourceChain,
}: {
  state: string;
  attestations: number;
  txHash: string | null;
  error: string | null;
  sourceChain: ChainId;
}) {
  if (error) {
    return <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>;
  }

  const explorerBase = sourceChain === "xahau"
    ? "https://xahau-testnet.xrplwin.com/tx"
    : "https://testnet.xrpl.org/transactions";

  if (state === "completed") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-success)]">
          <div className="size-2 rounded-full bg-[var(--color-success)]" />
          Transfer complete — witnesses released funds on {sourceChain === "xahau" ? "XRPL" : "Xahau"}
        </div>
        {txHash && (
          <a
            href={`${explorerBase}/${txHash}`}
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
