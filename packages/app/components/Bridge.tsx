"use client";

import { useState } from "react";
import type { BridgeDirection } from "@xbridge/sdk";

export function Bridge() {
  const [direction, setDirection] = useState<BridgeDirection>("xahau-to-xrpl");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const from = direction === "xahau-to-xrpl" ? "Xahau" : "XRPL";
  const to = direction === "xahau-to-xrpl" ? "XRPL" : "Xahau";

  const toggleDirection = () => {
    setDirection((d) => (d === "xahau-to-xrpl" ? "xrpl-to-xahau" : "xahau-to-xrpl"));
  };

  const handleBridge = async () => {
    if (!amount) return;
    setStatus("Connecting wallets...");
    // TODO: Wire up @xbridge/sdk + wallet connection
    setStatus("Bridge flow not yet connected — SDK integration pending");
  };

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
      {/* From */}
      <div className="rounded-xl bg-gray-800 p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">From</div>
        <div className="flex items-center justify-between">
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-gray-600"
          />
          <span className="ml-4 whitespace-nowrap rounded-lg bg-gray-700 px-3 py-1 text-sm font-medium">
            {from}
          </span>
        </div>
      </div>

      {/* Direction toggle */}
      <div className="flex justify-center -my-3 relative z-10">
        <button
          onClick={toggleDirection}
          className="rounded-xl border-4 border-gray-900 bg-gray-800 p-2 transition-colors hover:bg-gray-700"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* To */}
      <div className="rounded-xl bg-gray-800 p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">To</div>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-semibold text-gray-400">{amount || "0.00"}</span>
          <span className="ml-4 whitespace-nowrap rounded-lg bg-gray-700 px-3 py-1 text-sm font-medium">
            {to}
          </span>
        </div>
      </div>

      {/* Bridge button */}
      <button
        onClick={handleBridge}
        disabled={!amount}
        className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-center font-semibold transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Bridge {from} → {to}
      </button>

      {/* Status */}
      {status && (
        <div className="mt-4 rounded-lg bg-gray-800 p-3 text-center text-sm text-gray-400">
          {status}
        </div>
      )}
    </div>
  );
}
