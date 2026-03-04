# BAGLO — Decentralized Remittance & Exchange on Stacks

## Stacks Knowledge
Stacks knowledge can be found at @.claude/stacks/knowledge/general-stacks-knowledge.md

## Project Overview
Baglo is a decentralized remittance and exchange app on Stacks blockchain.
- **Deposit**: User pays NGN (fiat) → receives stablecoin (USDCx) in wallet
- **Withdraw**: User locks stablecoin → receives NGN to Nigerian bank account
- **Send**: Transfer stablecoins to external wallets (Bitget, KuCoin, etc.)
- **P2P Escrow**: Trustless peer-to-peer trading with on-chain escrow

## Architecture
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend    │────▶│   Backend    │────▶│  Flutterwave │
│  React/Next   │     │  Express.js  │     │   (Fiat)     │
│  Stacks.js    │     │  MongoDB     │     │   Payments   │
└──────┬───────┘     └──────┬───────┘     └──────────────┘
       │                     │
       ▼                     ▼
┌──────────────────────────────────┐
│    Stacks Blockchain             │
│    baglo-core.clar (escrow)      │
│    mock-usdcx.clar (test token)  │
│    sip010-ft-trait.clar          │
└──────────────────────────────────┘
```

## Tech Stack
- **Smart Contracts**: Clarity v2 (Epoch 2.5), tested with Clarinet SDK v3 + Vitest
- **Backend**: Express.js + TypeScript, Flutterwave SDK, @stacks/transactions
- **Frontend**: React/Next.js, @stacks/connect (Hiro Wallet), Tailwind CSS
- **Database**: MongoDB (order tracking)
- **Fiat Rails**: Flutterwave (Nigeria bank transfers + payouts)

## Smart Contracts (`contracts/`)
1. **sip010-ft-trait.clar** — Standard SIP-010 fungible token interface
2. **mock-usdcx.clar** — Test stablecoin (mint/faucet for testnet, 6 decimals)
3. **baglo-core.clar** — Main contract with:
   - `create-withdrawal` / `confirm-withdrawal` — Crypto-to-fiat flow
   - `create-deposit` / `confirm-deposit` — Fiat-to-crypto flow
   - `create-p2p-order` / `confirm-p2p-release` — P2P escrow
   - `dispute-order` / `cancel-order` — Dispute & cancellation handling
   - `fund-pool` / `drain-pool` — Liquidity management
   - Protocol fee: 0.3% (30 bps), max 5% (500 bps)
   - Timeout: 144 blocks (~24h) for withdrawals, 288 blocks (~48h) for P2P

## Backend (`backend/src/`)
- `index.ts` — Express server with routes
- `config.ts` — Environment configuration
- `services/stacks.ts` — On-chain tx broadcasting (confirm deposits/withdrawals)
- `services/flutterwave.ts` — Fiat operations (bank transfers, payouts, rates)
- `routes/deposit.ts` — POST /api/deposit/initiate, GET /api/deposit/rate
- `routes/withdraw.ts` — POST /api/withdraw/initiate, resolve-account, banks
- `routes/webhook.ts` — Flutterwave webhook handler (automated on-chain confirmation)
- `models/order.ts` — MongoDB schema for off-chain order tracking

## Frontend (`frontend/src/`)
- `lib/stacks.ts` — Wallet connect, contract calls, read-only queries
- `lib/api.ts` — Backend API client
- `components/BagloApp.tsx` — Main dashboard (4 tabs: Buy/Sell/Send/P2P)

## Key Commands
```bash
# Validate contracts
clarinet check

# Run tests
npm test

# Start backend
cd backend && npm install && npm run dev

# Start frontend
cd frontend && npm install && npm run dev

# Deploy to testnet
clarinet deployments generate --testnet
clarinet deployments apply -p deployments/default.testnet-plan.yaml
```

## Environment Variables (backend/.env)
```
PORT=3001
STACKS_NETWORK=testnet
STACKS_API_URL=https://api.testnet.hiro.so
CONTRACT_ADDRESS=<deployer-address>
CONTRACT_NAME=baglo-core
TOKEN_CONTRACT_ADDRESS=<deployer-address>
TOKEN_CONTRACT_NAME=mock-usdcx
ADMIN_PRIVATE_KEY=<from clarinet keychain>
FLW_PUBLIC_KEY=<from flutterwave dashboard>
FLW_SECRET_KEY=<from flutterwave dashboard>
FLW_ENCRYPTION_KEY=<from flutterwave dashboard>
FLW_WEBHOOK_SECRET=<from flutterwave dashboard>
MONGODB_URI=<from mongodb atlas>
DEFAULT_NGN_RATE=1500
DEFAULT_GBP_RATE=0.79
```

## Target Market
- Nigeria: $22B+ annual remittances, 32% crypto adoption
- Total fees: 0.8-1.8% (vs P2P 1-3%, traditional 6-9%)
- Phase 1: Nigeria MVP → Phase 2: UK corridor → Phase 3: Global
