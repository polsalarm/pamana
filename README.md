<div align="center">

# 🪙 Pamana

> Trustless on-chain inheritance for Filipino families. When you go silent, your family inherits — no company, no lawyer, no court.

![Stellar](https://img.shields.io/badge/Stellar-Testnet-00B4D8?style=flat&logo=stellar&logoColor=white)
![Soroban](https://img.shields.io/badge/Soroban-Smart%20Contracts-008055?style=flat)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.80+-DEA584?style=flat&logo=rust&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-22C55E?style=flat)

**Rise In × Stellar APAC Hackathon 2026** · Track: Local Finance & Real World Access · Deadline: **2026-07-15**

**Docs:** [📖 Full Project Document →](Pamana-Full-Document.md) · [🗺️ Build Plan →](docs/BUILD_PLAN.md) · [🔗 Stellar Resources →](docs/STELLAR_DEVELOPER_RESOURCES.md)

</div>

---

> 🚧 **Status: In active development** — building to July 15, 2026.
>
> **▶ Live (Testnet):** https://pamana-sigma.vercel.app · contracts deployed on Stellar Testnet (factory `CAMKUF…`). Demo videos land as phases complete (see [Build Plan](docs/BUILD_PLAN.md)).

## 🧩 Problem
When a Filipino crypto holder dies or becomes incapacitated, their self-custodied assets are lost permanently. There is no seed-phrase recovery, no probate for private keys, no legal mechanism that reaches a wallet the way it freezes a bank account.
- Hits hardest in families with no estate-planning culture, no lawyer access, and OFW / informal-earner members with the least cushion to absorb total loss
- Existing "crypto inheritance" products solve this by reintroducing a custodian — an off-chain company, a foreign legal entity, or a key-share they hold
- That inheritance only fires if the company survives and chooses to cooperate. A bank with extra steps.

## 🌟 Vision
A Philippines where every crypto holder can pass on their assets trustlessly — inheritance enforced by open Stellar rails, not by a company that has to stay alive to honor it. If the app, the company, and the servers all disappear, the family still inherits.

## 🎯 Purpose
Make inheritance a property of the asset itself. A Soroban proof-of-life vault executes the transfer on-chain the moment the owner goes silent past a timeout — no custodian in the loop at any step. Mission is real-world access and family protection, not crypto speculation.

## 👥 Target Users
- **Owners** — OFWs and first-gen crypto holders who want their family to inherit without a lawyer or seed-phrase handoff
- **Heirs** — the explicit design target: someone who has never touched a wallet claims with a tap, not a 24-word phrase
- **Informal earners** — sari-sari owners, market vendors, tricycle drivers with no estate-planning access

## ✨ Features
- **Trustless Inheritance (Heartbeat)** — Soroban vault holds USDC; owner calls `check_in()` to prove life; if silent past timeout (default 90 days) any heir may `claim()`. No company, no key-share held by anyone
- **Multi-Heir BPS Splits** — heirs designated in basis points (sum = 10,000); pull-based, independent claims; `TotalLocked` snapshot on first claim so no heir is shortchanged
- **Social Recovery** — native Stellar multisig guardians (N-of-M) + SEP-30 recoverysigner; recover a lost key without a seed phrase
- **NFC Heir Claim Card** — Tapik-style NFC tap on Android; the inheritance address is bound to the card, heir claims with a tap
- **Time-Locked Release (Trust Fund)** — scheduled tranches (e.g. 25%/year over 4 years) enforced on-chain; each tranche claims independently
- **PDAX PHP On/Off-Ramp** — BSP-licensed PHP ⇄ USDC: on-ramp funds a vault with pesos, off-ramp converts an heir's claim to GCash/Maya/bank
- **RWA Asset Card** *(roadmap stub)* — mock on-chain real-world asset display
- **Sentinel Monitor** *(roadmap stub)* — 24/7 anomaly-detection status light

## 🔄 How it works (Freighter flow)

Every user is the **owner of their own vault**. The factory is a shared "vault printer" — each `create_vault` deploys a fresh, isolated vault contract for that wallet.

1. **Connect** — open the app, approve Freighter. The app knows your address (`GABC…YOU`) — your existing wallet, no new account.
2. **Create your vault** — click *Create Vault* → sign in Freighter → the factory deploys a brand-new vault **just for you** (`CXYZ…MINE`). One vault per wallet.
3. **Add heirs** — paste another Stellar address (e.g. a second Freighter wallet, your child's), set their share in basis points (splits allowed). Sign as owner. Heirs don't need to do anything yet.
4. **Fund** — `deposit` USDC/XLM into your vault.
5. **Stay alive** — tap *I'm Alive* (`check_in`) before the timeout to reset the countdown.
6. **Inheritance fires** — if you go silent past the timeout, an heir connects their wallet and clicks *Claim* → their share lands in their wallet. No company, no court.

> Heir = any Stellar address. The CLI tests sign from the terminal; Freighter just moves the signing into a browser popup — same transactions.

## 🛠️ Tech Stack
- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS
- **Blockchain:** Stellar (Soroban smart contracts in Rust `soroban-sdk`, Stellar RPC, SEP-30) — **factory + vault** contracts
- **Asset:** USDC via Stellar Asset Contract (SAC)
- **Auth / signing:** Freighter wallet · passkeys / smart accounts (no seed phrase for heirs)
- **NFC:** NTAG 424 DNA card + Web NFC API (Android)
- **On/Off-ramp:** PDAX API (PHP ⇄ USDC)
- **Off-chain (deferred):** Supabase — heir contacts + check-in reminders, only if wired
- **Network:** Stellar Testnet

## 🚀 How to Run Locally

### Prerequisites
- **Node.js** 20+
- **Rust** + wasm target — `rustup target add wasm32-unknown-unknown`
- **[stellar-cli](https://github.com/stellar/stellar-cli)**
- **Wallet** — [Freighter](https://www.freighter.app/) (desktop) or a passkey-capable browser

### 1. Clone
```bash
git clone https://github.com/polsalarm/pamana
cd pamana
```

### 2. Build / test contracts
```bash
cd contracts
cargo test --workspace        # unit tests (vault + factory)
stellar contract build        # WASM for deployment
```

### 3. Run frontend
```bash
cd frontend
cp .env.example .env.local     # fill in contract IDs + network
npm ci
npm run dev                    # http://localhost:5173
```

### 4. Configure env (`frontend/.env.local`)
```env
VITE_STELLAR_NETWORK=testnet
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_FACTORY_CONTRACT_ID=       # from Phase 4 deploy
VITE_USDC_SAC_ID=               # USDC SAC on testnet

# PDAX ramp (server-only — never ship to client)
PDAX_API_KEY=
PDAX_API_SECRET=
PDAX_BASE_URL=https://api.pdax.ph
```

## 🧪 Testnet Deployment

Deploys in Phase 4 (see [Build Plan](docs/BUILD_PLAN.md)).

| Contract | Address | Explorer |
|----------|---------|----------|
| PamanaFactory | `TBD` | — |
| PamanaVault (per family) | `TBD` | — |

Network: Stellar Testnet (`Test SDF Network ; September 2015`). Resets ~quarterly — redeploy + update `.env.local` after each reset.

## 🎬 Demo

| Item | Link |
|------|------|
| 🔗 Live App | TBD |
| 🎥 Demo Video | TBD |
| 🖼️ Pitch Deck | TBD |

The stage demo (doc §7) ends on the mic-drop: kill the backend server live, re-run the heir's claim — it still works. The blockchain is the executor.

## 👤 Team
| Name | Role | GitHub |
|------|------|--------|
| Paul Henry Dacalan | Project Lead / Developer · Stellar Ambassador PH | [@polsalarm](https://github.com/polsalarm) |

FEU Institute of Technology.

## 📄 License
MIT
