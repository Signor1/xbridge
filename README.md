# XBridge

Cross-chain bridge between **Xahau** and **XRPL Mainnet** using the native XChainBridge protocol (XLS-38d).

Users visit a one-page app, connect their wallets, pick a direction, enter an amount, and bridge. Behind the scenes, XRPL's native cross-chain protocol handles claim IDs, witness attestations, and automatic asset release.

## How Bridging Works

When a user bridges a token from Xahau to XRPL:

1. The original token is **locked** in a door account on Xahau
2. A 1:1 backed representation is **issued** on XRPL by the XRPL door account
3. Witness servers independently verify the lock and attest to it on XRPL
4. Once enough witnesses agree (2-of-3 quorum), XRPL automatically releases the tokens

Bridging back works in reverse — the XRPL representation is burned, witnesses attest, and the original unlocks on Xahau.

The XRPL-side token is technically issued by the bridge door account (different trust line than the Xahau original). This is how all cross-chain bridges work — two separate ledgers cannot share the same native token. The 1:1 backing guarantee comes from the locked supply in the Xahau door account.

**v1 supports fungible tokens (IOUs) and native currency (XAH/XRP).** NFT bridging is not supported by the XChainBridge protocol.

## Packages

### `@xbridge/config`

Shared foundation used by every other package. Contains:

- **Chain definitions** — network IDs, WebSocket URLs, explorer links, and faucet endpoints for Xahau and XRPL (both testnet and mainnet)
- **Type definitions** — `BridgeDefinition`, `Transfer`, `TransferStatus`, `BridgeDirection`, `WitnessConfig`, and all other shared types
- **Bridge helpers** — functions to construct `XChainBridge` objects, create native/IOU issue definitions

No runtime dependencies. Pure TypeScript types and configuration.

### `@xbridge/setup`

One-time CLI scripts that create and configure the bridge infrastructure on both chains. Run these once per network (testnet or mainnet), not per user.

| Script | What it does |
|--------|-------------|
| `01-fund-doors.ts` | Generates or loads door account wallets, funds them via testnet faucets (or prints addresses for manual mainnet funding) |
| `02-create-bridge.ts` | Submits `XChainCreateBridge` on both Xahau and XRPL with identical bridge definitions |
| `03-set-signer-list.ts` | Configures multisig (SignerList) on door accounts for admin security |
| `04-setup-trust.ts` | Creates trust lines on door accounts for IOU bridging (e.g., AXK) |
| `05-verify.ts` | Queries both chains to confirm bridge objects exist and match |

After running setup, the door account addresses and seeds go into `.env` files for the witness servers.

### `@xbridge/witness`

The core of the bridge — a Node.js process that runs 24/7 and makes cross-chain transfers possible. You run 3 instances (2-of-3 quorum).

**What it does:**
1. Connects to both Xahau and XRPL via WebSocket
2. Subscribes to door account transactions on both chains
3. When it detects an `XChainCommit` (user locking assets):
   - Validates the commit (amount, claim ID, source account)
   - Constructs an `XChainAddClaimAttestation` transaction
   - Signs it with its unique Ed25519 key
   - Submits to the destination chain
4. Tracks processed commits in SQLite to prevent double-attestation
5. Exposes a `/health` endpoint (Fastify)

Each witness instance has its own signing key and runs independently. They don't communicate with each other — they just watch the same chains and submit attestations separately. The XRPL protocol handles quorum counting and auto-release.

**Stack:** TypeScript, @transia/xrpl, better-sqlite3, Fastify

### `@xbridge/sdk`

TypeScript SDK that wraps the full bridge flow into a simple API. Used by the web app and available for any integration.

```typescript
import { BridgeClient } from '@xbridge/sdk';

const bridge = new BridgeClient({ env: 'testnet', bridgeDefinition });
await bridge.connect();

// Step 1: Reserve a claim ID on the destination chain
const claimId = await bridge.createClaimId({
  wallet: xrplWallet,
  direction: 'xahau-to-xrpl',
  otherChainSource: xahauAddress,
});

// Step 2: Commit (lock) assets on the source chain
const txHash = await bridge.commit({
  wallet: xahauWallet,
  direction: 'xahau-to-xrpl',
  claimId,
  amount: '1000000', // drops
  destination: xrplAddress,
});

// Step 3: Check status (witnesses attest automatically)
const status = await bridge.getClaimStatus('xahau-to-xrpl', claimId);
// { attestations: 2, completed: false }
// ... eventually ...
// { attestations: 0, completed: true }  ← claim consumed, transfer done
```

Works in both browser and Node.js.

### `@xbridge/app`

One-page bridge UI built with Next.js and Tailwind CSS.

- Direction toggle: Xahau → XRPL or XRPL → Xahau
- Wallet connection (Crossmark for Xahau, Xaman/GemWallet for XRPL)
- Amount input with balance display
- Live transfer status tracking (committed → attesting → done)
- Transaction explorer links for both chains

Single page — no routing, no login, no accounts. Connect wallet, enter amount, bridge.

## Project Structure

```
xbridge/
├── packages/
│   ├── config/          # Shared types + chain config
│   ├── setup/           # Bridge setup CLI scripts
│   ├── witness/         # Witness server (3 instances)
│   ├── sdk/             # TypeScript SDK
│   └── app/             # Next.js bridge UI
├── docker-compose.yml   # Run 3 witnesses locally
├── turbo.json           # Turborepo task config
├── pnpm-workspace.yaml  # Workspace definition
└── tsconfig.base.json   # Shared TypeScript config
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Install

```bash
pnpm install
```

### Build

```bash
pnpm build
```

### Set Up Bridge (Testnet)

```bash
# 1. Generate and fund door accounts
cd packages/setup
cp ../../.env.example .env
pnpm fund-doors
# → Save the printed XAHAU_DOOR_SEED, XRPL_DOOR_SEED etc. into .env

# 2. Create bridge on both chains
pnpm create-bridge

# 3. Verify bridge exists
pnpm verify
```

### Run Witnesses

```bash
# Create .env files for each witness (different WITNESS_SEED for each)
cp .env.example .env.witness1
cp .env.example .env.witness2
cp .env.example .env.witness3
# Edit each with unique WITNESS_NAME and WITNESS_SEED

# Run all 3
docker compose up
```

### Start the UI

```bash
cd packages/app
pnpm dev
# → http://localhost:3000
```

## Networks

| Network | WebSocket | Network ID | Explorer | Faucet |
|---------|-----------|------------|----------|--------|
| Xahau Mainnet | wss://xahau.network | 21337 | https://xahau.xrplwin.com | — |
| Xahau Testnet | wss://xahau-test.net | 21338 | https://xahau-testnet.xrplwin.com | POST https://xahau-test.net/accounts |
| XRPL Mainnet | wss://xrplcluster.com | 0 | https://livenet.xrpl.org | — |
| XRPL Testnet | wss://s.altnet.rippletest.net:51233 | 1 | https://testnet.xrpl.org | POST https://faucet.altnet.rippletest.net/accounts |

**Faucets:** POST with empty body creates a new account. POST with `{ "destination": "rAddress..." }` funds an existing account.

## Security

- Door accounts should have master keys disabled after setup (SignerList multisig for admin)
- Each witness has a unique Ed25519 signing key — never share or reuse
- Supply invariant: tokens locked in Xahau door must always equal tokens issued on XRPL
- Witnesses track processed commits in SQLite to prevent double-attestation

## Tech Stack

| Package | Technologies |
|---------|-------------|
| config | TypeScript |
| setup | TypeScript, @transia/xrpl |
| witness | TypeScript, @transia/xrpl, better-sqlite3, Fastify |
| sdk | TypeScript, @transia/xrpl |
| app | Next.js, React, Tailwind CSS |
| build | Turborepo, pnpm workspaces |

## License

MIT
