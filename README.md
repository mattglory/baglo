# BAGLO — Decentralized Remittance & Exchange

**Instant Crypto ↔ Fiat | Nigeria First | Built on Stacks**

## What Baglo Does

| Feature | Flow | Fee |
|---------|------|-----|
| **Buy (Deposit)** | NGN → Bank Transfer → USDCx to your wallet | 0.8-1.2% |
| **Sell (Withdraw)** | USDCx → Lock on-chain → NGN to your bank (<2min) | 0.8-1.8% |
| **Send** | USDCx → Any Stacks address (Bitget, KuCoin, etc.) | ~0.001 STX |
| **P2P Escrow** | Trustless peer-to-peer with on-chain escrow | 0.3% |

## Architecture

```
User → Frontend (React/Next.js) → Stacks Blockchain (Clarity contracts)
                                 → Backend (Express) → Flutterwave (NGN fiat)
```

- **Smart Contracts**: baglo-core.clar (escrow, deposits, withdrawals, P2P)
- **Backend**: Express + Flutterwave APIs + MongoDB tracking
- **Frontend**: React + @stacks/connect wallet integration

## Quick Start with Claude Code

### 1. Test Smart Contracts
```bash
cd C:\Users\mattg\flashstack\baglo
npm install
npm test
```

### 2. Setup Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your API keys (see below)
npm run dev
```

### 3. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Open http://localhost:3000 and connect Hiro Wallet

## API Keys Needed

| Service | Get it at | Required for |
|---------|-----------|--------------|
| **Flutterwave** | dashboard.flutterwave.com | NGN deposits & payouts |
| **MongoDB Atlas** | mongodb.com/cloud/atlas | Order tracking |
| **Stacks Testnet Key** | `npx @stacks/cli make_keychain -t` | On-chain admin ops |
| **Testnet STX** | explorer.hiro.so/sandbox/faucet | Gas fees |

## Contract Deployment

```bash
# Validate contracts
clarinet check

# Run tests
npm test

# Deploy to testnet
clarinet deployments generate --testnet
clarinet deployments apply -p deployments/default.testnet-plan.yaml
```

After deploying, update:
- `frontend/src/lib/stacks.ts` → `CORE_CONTRACT.address`
- `backend/.env` → `CONTRACT_ADDRESS` and `TOKEN_CONTRACT_ADDRESS`

## Project Structure

```
baglo/
├── contracts/           # Clarity smart contracts
│   ├── sip010-ft-trait.clar    # SIP-010 token standard
│   ├── mock-usdcx.clar        # Test stablecoin
│   └── baglo-core.clar        # Main contract (escrow, fees, admin)
├── tests/
│   └── baglo-core.test.ts     # Vitest unit tests
├── backend/             # Express + Flutterwave
│   └── src/
│       ├── index.ts            # Server entry
│       ├── config.ts           # Environment config
│       ├── models/order.ts     # MongoDB order schema
│       ├── services/stacks.ts  # On-chain operations
│       ├── services/flutterwave.ts  # Fiat operations
│       ├── routes/deposit.ts   # Buy crypto endpoints
│       ├── routes/withdraw.ts  # Sell crypto endpoints
│       └── routes/webhook.ts   # Flutterwave automation
├── frontend/            # React + Stacks wallet
│   └── src/
│       ├── lib/stacks.ts       # Blockchain integration
│       ├── lib/api.ts          # Backend API client
│       └── components/BagloApp.tsx  # Main dashboard
├── Clarinet.toml        # Contract config
├── vitest.config.js     # Test config
└── package.json         # Root dependencies (clarinet-sdk)
```

## Target Market

- Nigeria: $22B+ annual remittances, 32% crypto adoption, 70% unbanked
- Competitive: 0.8-1.8% total fees vs P2P 1-3%, traditional 6-9%

## Roadmap

- [x] Phase 1: Smart contracts + backend + frontend (current)
- [ ] Phase 2: Testnet deployment + beta testing
- [ ] Phase 3: Real USDCx integration (Circle on Stacks)
- [ ] Phase 4: UK corridor (GBP support)
- [ ] Phase 5: Multi-country expansion
