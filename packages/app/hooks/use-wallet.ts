"use client";

import { useState, useEffect, useCallback } from "react";

interface WalletState {
  address: string | null;
  network: { protocol: string; type: string; wss: string } | null;
  connected: boolean;
  installed: boolean;
  loading: boolean;
}

// Crossmark SDK is browser-only — lazy import to avoid SSR issues
let sdkInstance: any = null;

async function getSdk() {
  if (sdkInstance) return sdkInstance;
  const mod = await import("@crossmarkio/sdk");
  sdkInstance = mod.default;
  return sdkInstance;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    network: null,
    connected: false,
    installed: false,
    loading: true,
  });

  // Check if Crossmark is installed on mount
  useEffect(() => {
    const check = async () => {
      try {
        const sdk = await getSdk();
        const installed = sdk.sync.isInstalled() ?? false;
        const address = sdk.sync.getAddress() ?? null;
        const network = sdk.sync.getNetwork() ?? null;
        const connected = !!address;

        setState({
          address,
          network,
          connected,
          installed,
          loading: false,
        });
      } catch {
        setState((s) => ({ ...s, loading: false, installed: false }));
      }
    };

    // Small delay to let the extension inject
    const timer = setTimeout(check, 500);
    return () => clearTimeout(timer);
  }, []);

  // Listen for network changes
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const setup = async () => {
      try {
        const sdk = await getSdk();

        const handleNetworkChange = (network: any) => {
          setState((s) => ({ ...s, network }));
        };

        const handleSignout = () => {
          setState((s) => ({
            ...s,
            address: null,
            network: null,
            connected: false,
          }));
        };

        sdk.on("network-change", handleNetworkChange);
        sdk.on("signout", handleSignout);

        cleanup = () => {
          sdk.off("network-change", handleNetworkChange);
          sdk.off("signout", handleSignout);
        };
      } catch {
        // SDK not available
      }
    };

    setup();
    return () => cleanup?.();
  }, []);

  const connect = useCallback(async () => {
    try {
      setState((s) => ({ ...s, loading: true }));
      const sdk = await getSdk();

      const { response } = await sdk.methods.signInAndWait();
      const address = response?.data?.address ?? null;
      const network = sdk.sync.getNetwork() ?? null;

      setState({
        address,
        network,
        connected: !!address,
        installed: true,
        loading: false,
      });

      return address;
    } catch (err) {
      setState((s) => ({ ...s, loading: false }));
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    setState((s) => ({
      ...s,
      address: null,
      connected: false,
    }));
  }, []);

  const signAndSubmit = useCallback(
    async (tx: Record<string, unknown>) => {
      const sdk = await getSdk();

      const { response } = await sdk.methods.signAndSubmitAndWait(tx as any);

      const result = response?.data?.resp?.result;
      const hash = result?.hash ?? response?.data?.resp?.hash;

      if (!hash) {
        throw new Error("Transaction failed — no hash returned");
      }

      return {
        hash: hash as string,
        result: result,
      };
    },
    [],
  );

  return {
    ...state,
    connect,
    disconnect,
    signAndSubmit,
  };
}
