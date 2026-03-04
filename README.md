# Baglo — Decentralized Remittance & Exchange on Bitcoin/Stacks

> **Instant NGN ↔ USDCx | Nigeria First | Built on Stacks (Bitcoin Layer)**

[![Tests](https://img.shields.io/badge/tests-35%20passing-brightgreen)](./tests)
[![Testnet](https://img.shields.io/badge/testnet-deployed-blue)](https://explorer.hiro.so/address/ST1T5B2J6JA3WTANYTSCTG0D45W760XF769XC1M13?chain=testnet)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Clarity v2](https://img.shields.io/badge/Clarity-v2-orange)](https://docs.stacks.co/clarity)

Baglo makes cross-border crypto-to-fiat remittance trustless and cheap for Nigeria. Users deposit NGN via bank transfer and receive USDCx stablecoins on-chain, or lock USDCx to receive NGN to any Nigerian bank account — all with on-chain escrow and protocol fees of just 0.3%.

---

## How It Works

| Feature | Flow | Fee |
|---------|------|-----|
| **Buy (Deposit)** | NGN via bank transfer → USDCx to your Stacks wallet | ~0.8–1.2% |
| **Sell (Withdraw)** | Lock USDCx on-chain → NGN to any Nigerian bank (<2 min) | ~0.8–1.8% |
| **Send** | USDCx → any Stacks address (Bitget, KuCoin, wallets) | ~0.001 STX |
| **P2P Escrow** | Trustless peer-to-peer (contract ready, UI coming in Phase 5) | 0.3% |

**Why Nigeria?** $22B+ annual remittances. Traditional wire transfers cost 6–9%. Baglo targets 0.8–1.8% total — a 4–5× improvement.

---

## Architecture

```
User Wallet (Hiro/Leather)
        │
        ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Frontend         │────▶│  Backend          │────▶│  Flutterwave     │
│  Next.js 15       │     │  Express + TS     │     │  (NGN fiat rails)│
│  @stacks/connect  │     │  MongoDB          │     │  Bank payouts    │
└────────┬─────────┘     └────────┬─────────┘     └──────────────────┘
         │                         │
         ▼                         ▼
┌──────────────────────────────────────────────┐
│              Stacks Blockchain (Bitcoin L2)   │
│  ST1T5B2J6...baglo-core.clar  (escrow + fees)│
│  ST1T5B2J6...mock-usdcx.clar  (test token)   │
│  ST1T5B2J6...sip010-ft-trait.clar            │
└──────────────────────────────────────────────┘
```

---

## Testnet Deployment

All contracts deployed to **Stacks Testnet** on February 25, 2026 — all transactions confirmed with `success` status.

| Contract | Address | Explorer |
|----------|---------|---------|
| `baglo-core` | `ST1T5B2J6JA3WTANYTSCTG0D45W760XF769XC1M13.baglo-core` | [View ↗](https://explorer.hiro.so/txid/0x1cc649e2b54152ce605cc95f111e77806256a4dd4dffd69f7191066c8e4b6443?chain=testnet) |
| `mock-usdcx` | `ST1T5B2J6JA3WTANYTSCTG0D45W760XF769XC1M13.mock-usdcx` | [View ↗](https://explorer.hiro.so/txid/0x80705038f9e7141f5eb602becd8189d21cf9cac08c40a0bbded314359607b0dc?chain=testnet) |
| `sip010-ft-trait` | `ST1T5B2J6JA3WTANYTSCTG0D45W760XF769XC1M13.sip010-ft-trait` | [View ↗](https://explorer.hiro.so/txid/0xd555a65233e0fafa84f2122a2f47b64f46b6265dadfcd31ab1b1818fad00201b?chain=testnet) |

---

## Smart Contracts

**`contracts/baglo-core.clar`** — Main escrow and remittance logic:
- `create-withdrawal` / `confirm-withdrawal` — Crypto-to-fiat (user locks, admin confirms after bank payout)
- `create-deposit` / `confirm-deposit` — Fiat-to-crypto (user pays NGN, webhook triggers token release)
- `cancel-order` — Self-cancel with timeout (144 blocks / ~24h)
- `fund-pool` / `drain-pool` — Liquidity management (owner-only drain)
- `add-admin` / `set-protocol-fee` / `set-paused` — Governance

**`contracts/mock-usdcx.clar`** — SIP-010 test stablecoin for testnet (6 decimals, faucet enabled).

Protocol fee: **0.3% (30 bps)**, configurable up to 5% max.

---

## Quick Start

### Prerequisites
- [Clarinet](https://docs.hiro.so/clarinet) (contract dev + testing)
- Node.js 18+
- [Hiro Wallet](https://wallet.hiro.so) (browser extension)
- MongoDB Atlas free tier
- Flutterwave account

### 1. Clone & Test Contracts

```bash
git clone https://github.com/mattglory/baglo.git
cd baglo
npm install
npm test
# 35 tests passing (22 baglo-core + 13 mock-usdcx)
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in .env with your keys (see API Keys section below)
npm run dev
# Server starts on http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# App starts on http://localhost:3000
```

### 4. Connect Hiro Wallet and use the app at `http://localhost:3000`

---

## API Keys Needed

| Service | Where to get it | Used for |
|---------|----------------|----------|
| **Flutterwave** | [dashboard.flutterwave.com](https://dashboard.flutterwave.com) | NGN bank transfers + payouts |
| **MongoDB Atlas** | [mongodb.com/atlas](https://www.mongodb.com/atlas) | Order tracking |
| **Stacks testnet key** | `npx @stacks/cli make_keychain -t` | Admin on-chain ops |
| **Testnet STX** | [explorer.hiro.so/sandbox/faucet](https://explorer.hiro.so/sandbox/faucet) | Gas fees |

---

## Project Structure

```
baglo/
├── contracts/                  # Clarity smart contracts (Epoch 2.5)
│   ├── sip010-ft-trait.clar   # SIP-010 fungible token interface
│   ├── mock-usdcx.clar        # Testnet stablecoin (faucet-enabled)
│   └── baglo-core.clar        # Main contract: escrow, deposits, withdrawals
├── tests/
│   ├── baglo-core.test.ts     # 22 unit tests (Vitest + Clarinet SDK)
│   └── mock-usdcx.test.ts     # 13 unit tests
├── backend/                   # Express.js API server
│   └── src/
│       ├── index.ts           # Server entry point
│       ├── config.ts          # Environment config
│       ├── models/order.ts    # MongoDB order schema
│       ├── models/user.ts     # MongoDB user/profile schema
│       ├── services/stacks.ts # On-chain transaction broadcasting
│       ├── services/flutterwave.ts  # Fiat rails: bank transfers + rates
│       ├── routes/deposit.ts  # POST /api/deposit/initiate
│       ├── routes/withdraw.ts # POST /api/withdraw/initiate
│       ├── routes/profile.ts  # GET/POST /api/profile/:address
│       └── routes/webhook.ts  # Flutterwave webhook → on-chain confirm
├── frontend/                  # Next.js 15 App Router
│   └── src/
│       ├── app/               # Next.js pages
│       ├── components/
│       │   ├── BagloApp.tsx   # Main dashboard (Buy / Sell / Send / P2P tabs)
│       │   └── ProfileSetup.tsx
│       └── lib/
│           ├── stacks.ts      # Wallet connect + contract calls
│           ├── api.ts         # Backend API client
│           └── network.ts     # Network/contract config
├── deployments/               # Clarinet deployment plans
│   ├── default.testnet-plan.yaml
│   └── default.devnet-plan.yaml
├── Clarinet.toml              # Contract config (Clarity v2, Epoch 2.5)
├── vitest.config.js           # Test config
└── package.json               # Root dev dependencies
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
PORT=3001
STACKS_NETWORK=testnet
STACKS_API_URL=https://api.testnet.hiro.so
CONTRACT_ADDRESS=ST1T5B2J6JA3WTANYTSCTG0D45W760XF769XC1M13
CONTRACT_NAME=baglo-core
TOKEN_CONTRACT_ADDRESS=ST1T5B2J6JA3WTANYTSCTG0D45W760XF769XC1M13
TOKEN_CONTRACT_NAME=mock-usdcx
ADMIN_PRIVATE_KEY=<your_testnet_private_key>
FLW_PUBLIC_KEY=FLWPUBK-...
FLW_SECRET_KEY=FLWSECK-...
FLW_ENCRYPTION_KEY=...
FLW_WEBHOOK_SECRET=...
MONGODB_URI=mongodb+srv://...
DEFAULT_NGN_RATE=1600
```

---

## Contract Deployment

```bash
# Validate contracts
clarinet check

# Run tests (35 tests)
npm test

# Deploy to testnet
clarinet deployments apply -p deployments/default.testnet-plan.yaml
```

After deploying, update `CONTRACT_ADDRESS` in `backend/.env` and `frontend/src/lib/network.ts`.

---

## Roadmap

- [x] **Phase 1** — Smart contracts: escrow, deposit, withdrawal, P2P (Clarity v2)
- [x] **Phase 2** — Backend: Flutterwave NGN rails + MongoDB order tracking
- [x] **Phase 3** — Frontend: Hiro Wallet integration, 4-tab dashboard
- [x] **Phase 4** — Testnet deployment (Feb 2026) — all 3 contracts live
- [ ] **Phase 5** — Beta testing with real Nigerian bank accounts via Flutterwave sandbox
- [ ] **Phase 6** — Real USDCx integration ([Circle USDCx on Stacks](https://docs.stacks.co/learn/bridging/usdcx))
- [ ] **Phase 7** — UK corridor (GBP support)
- [ ] **Phase 8** — sBTC integration (BTC-backed escrow)
- [ ] **Phase 9** — Mainnet launch + multi-country expansion

---

## Why Stacks?

- **Bitcoin security** — All contracts settle on Bitcoin via Proof of Transfer
- **Clarity contracts** — Decidable language prevents entire classes of bugs (no reentrancy, no overflows)
- **SIP-010 standard** — Composable with any Stacks DeFi protocol
- **sBTC ready** — Future integration with sBTC enables BTC-native remittances

---

## Target Market

- **Nigeria**: $22B+ annual remittances, 32% crypto adoption rate
- **Problem**: Traditional wire transfers cost 6–9% in fees
- **Baglo**: 0.8–1.8% total fees — 4–5× cheaper
- **Phase 2**: UK-Nigeria corridor (one of the busiest remittance routes globally)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Clarity v2, Epoch 2.5 |
| Contract Testing | Clarinet SDK v3 + Vitest |
| Backend | Express.js + TypeScript |
| Database | MongoDB (order tracking) |
| Fiat Rails | Flutterwave (Nigeria) |
| Frontend | Next.js 15, Tailwind CSS |
| Wallet | @stacks/connect (Hiro/Leather) |
| Blockchain | Stacks testnet → mainnet |

---

## Contributing

PRs welcome. Run `npm test` before submitting. Contract changes require `clarinet check` to pass.

## License

MIT — see [LICENSE](./LICENSE)
