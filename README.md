# XBridge

Cross-chain bridge between **Xahau** and **XRPL Mainnet** using the native XChainBridge protocol (XLS-38d).

## Packages

| Package | Description |
|---------|-------------|
| `@xbridge/config` | Shared types, chain definitions, bridge configuration |
| `@xbridge/setup` | One-time bridge setup scripts (fund doors, create bridge) |
| `@xbridge/witness` | Witness server — watches both chains, submits attestations |
| `@xbridge/sdk` | TypeScript SDK for initiating transfers |
| `@xbridge/app` | One-page bridge UI (Next.js) |

## Quick Start

```bash
# Install
pnpm install

# Build all packages
pnpm build

# Fund door accounts (testnet)
cd packages/setup && pnpm fund-doors

# Create bridge on both chains
pnpm create-bridge

# Verify
pnpm verify

# Run 3 witness nodes
cd ../.. && docker compose up

# Start the UI
cd packages/app && pnpm dev
```

## Architecture

```
User (bridge UI)
    │
    ├── Creates claim ID on destination chain
    ├── Commits assets on source chain
    │
    ▼
Witness servers (3 nodes, 2-of-3 quorum)
    │
    ├── Detect XChainCommit on source chain
    ├── Sign XChainAddClaimAttestation
    ├── Submit to destination chain
    │
    ▼
Assets auto-released on destination chain
```

## Networks

| Network | WebSocket | ID |
|---------|-----------|-----|
| Xahau Mainnet | wss://xahau.network | 21337 |
| Xahau Testnet | wss://xahau-test.net | 21338 |
| XRPL Mainnet | wss://xrplcluster.com | 0 |
| XRPL Testnet | wss://s.altnet.rippletest.net:51233 | 1 |
