<div align="center">

# 🪙 Bequest

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
> **▶ Live (Testnet):** https://pamana-sigma.vercel.app · multi-token contracts on Stellar Testnet (factory `CANQJ6N5…`). Demo videos land as phases complete (see [Build Plan](docs/BUILD_PLAN.md)).

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
- **Trustless Inheritance (Heartbeat)** — Soroban vault holds any Stellar asset (XLM, USDC, any SAC / SEP-41); owner calls `check_in()` to prove life; if silent past timeout (default 90 days) any heir may `claim()`. No company, no key-share held by anyone
- **Multi-Heir BPS Splits** — heirs designated in basis points (sum = 10,000); pull-based, independent claims; `TotalLocked` snapshot on first claim so no heir is shortchanged
- **Social Recovery** *(partial)* — native Stellar multisig guardians added/removed via `setOptions`. Thresholds are **not** yet set, so this is designation, not N-of-M enforcement — see [What is *not* real yet](#️-what-is-not-real-yet)
- **NFC Heir Claim Card** — Android Chrome tap opens a prefilled claim deep-link stored on the tag. The card is a pointer: it holds no key and signs nothing
- **Time-Locked Release (Trust Fund)** — scheduled tranches (e.g. 25%/year over 4 years) enforced on-chain; each tranche claims independently
- **PDAX Off-Ramp** — BSP-licensed exchange. Live `v2/trade/price` quotes, a real on-chain XLM deposit into PDAX's Stellar custody address, then `/trade` + `/fiat/withdraw` to GCash/Maya/bank. **On-ramp (cash-in) is not implemented**, and PDAX's sandbox does not credit testnet deposits — see [What is *not* real yet](#️-what-is-not-real-yet)
- **Claimant Home** — a **My Assets** view reads your wallet's live balances straight from Horizon, so an heir sees exactly what they received after claiming, plus **Cash out / Cash in / Claim** actions and a live **Activity** feed of recent on-chain history. The bottom nav puts the **Vault** front-and-centre as a distinct raised tab.
- **Transaction feedback** — every on-chain / money action shows a **confirm → live pending → success/error** modal, and confirmed transactions link straight to Stellar Expert so you always know a claim actually settled.
- **RWA Asset Card** *(roadmap stub)* — mock on-chain real-world asset display
- **Sentinel Monitor** *(roadmap stub)* — 24/7 anomaly-detection status light

## 🔄 How it works (Freighter flow)

Every user is the **owner of their own vault**. The factory is a shared "vault printer" — each `create_vault` deploys a fresh, isolated vault contract for that wallet.

1. **Connect** — open the app, approve Freighter. The app knows your address (`GABC…YOU`) — your existing wallet, no new account.
2. **Create your vault** — click *Create Vault* → sign in Freighter → the factory deploys a brand-new vault **just for you** (`CXYZ…MINE`). One vault per wallet.
3. **Add heirs** — paste another Stellar address (e.g. a second Freighter wallet, your child's), set their share in basis points (splits allowed). Sign as owner. Heirs don't need to do anything yet.
4. **Fund** — `deposit` any Stellar asset (XLM, USDC, or add your own token by pasting its contract address). A vault can hold several — heirs inherit their share of each.
5. **Stay alive** — tap *I'm Alive* (`check_in`) before the timeout to reset the countdown.
6. **Inheritance fires** — if you go silent past the timeout, an heir taps **Claim** on their Home, connects their wallet and clicks *Claim* → they confirm, watch the live status, and their share lands in their wallet (with a Stellar Expert receipt link). It then shows up in their **My Assets** view, ready to cash out. No company, no court.

> Heir = any Stellar address. The CLI tests sign from the terminal; Freighter just moves the signing into a browser popup — same transactions.

## 🛠️ Tech Stack
- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS
- **Blockchain:** Stellar (Soroban smart contracts in Rust `soroban-sdk`, Stellar RPC, SEP-30) — **factory + vault** contracts
- **Asset:** USDC via Stellar Asset Contract (SAC)
- **Auth / signing:** Stellar Wallets Kit — Freighter (desktop) · LOBSTR / WalletConnect (Android). Passkey smart accounts are roadmap
- **NFC:** plain NTAG21x tag + Web NFC API (Android Chrome only)
- **Off-ramp:** PDAX Institutional API (crypto → PHP). Cash-in not implemented
- **Notifications:** Web Push (VAPID) — check-in reminders, opt-in from the vault dashboard. Demo-scoped: subscriptions are in-memory (see `frontend/api/_push.ts`), not a database, so they reset on redeploy/restart
- **Off-chain (deferred):** Supabase — heir contacts, only if wired
- **Network:** Stellar Testnet

## 🚀 How to Run Locally

### Prerequisites
- **Node.js** 20+
- **Rust** + wasm target — `rustup target add wasm32-unknown-unknown`
- **[stellar-cli](https://github.com/stellar/stellar-cli)**
- **Wallet** — [Freighter](https://www.freighter.app/) (desktop) or a passkey-capable browser

### 1. Clone
```bash
git clone https://github.com/polsalarm/bequest
cd bequest
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
VITE_FACTORY_CONTRACT_ID=CANQJ6N5BNPYY5CZWGRY7QTZKAY7IAIMSI7RPRNJZP564DROBWOG5PQM
VITE_WALLETCONNECT_PROJECT_ID=  # free at cloud.reown.com (Android wallets)

# PDAX ramp (server-only — never ship to client). Auth is username/password
# against the UAT sandbox; see docs/PDAX_API.md.
PDAX_USERNAME=                  # PDAX institutional login (email)
PDAX_PASSWORD=
PDAX_BASE_URL=https://uat.services.sandbox.pdax.ph/api/pdax-api
RAMP_RATE_FALLBACK=58           # PHP/USDC rate used when UAT OTC pricing is down
```

> Off-ramp endpoints (`/api/pdax-rate`, `/api/pdax-withdraw`) are Vercel serverless
> functions — the PDAX credentials stay server-side and never reach the browser.

## 🧪 Testnet Deployment

Live on Stellar Testnet (multi-token). See [contract-deployment.md](docs/contract-deployment.md).

| Contract | Address | Explorer |
|----------|---------|----------|
| PamanaFactory | `CANQJ6N5BNPYY5CZWGRY7QTZKAY7IAIMSI7RPRNJZP564DROBWOG5PQM` | [Stellar Expert →](https://stellar.expert/explorer/testnet/contract/CANQJ6N5BNPYY5CZWGRY7QTZKAY7IAIMSI7RPRNJZP564DROBWOG5PQM) |
| PamanaVault (per family) | `CDJOXNIY6FMVUBDCDYV3VXWDXVZ323WURQ3VOLSNGH6BTHBMXP7X5LJG` | [Stellar Expert →](https://stellar.expert/explorer/testnet/contract/CDJOXNIY6FMVUBDCDYV3VXWDXVZ323WURQ3VOLSNGH6BTHBMXP7X5LJG) |

Network: Stellar Testnet (`Test SDF Network ; September 2015`). Resets ~quarterly — redeploy + update `.env.local` after each reset.

## ⚖️ What is *not* real yet

The inheritance core is genuinely trustless and fully on-chain. Several things around it are not, and we'd rather say so than let a demo imply otherwise.

**The peso payout cannot complete end-to-end on testnet.** PDAX's UAT sandbox does hand out a *real* Stellar testnet custody address (`GET /crypto/deposit?currency=XLM_TEST` — it resolves on horizon-testnet and 404s on pubnet). The heir's cash-out really does send XLM to it, on-chain, with the required memo. But **PDAX's sandbox never credits testnet deposits**: a confirmed 25 XLM transfer moved the custody balance from `21492.80` → `21517.80` while `GET /balances` stayed flat and `GET /crypto/transactions` stayed empty for 10+ minutes. So the app stops at the deposit leg and links the transfer on Stellar Expert rather than pretending. There is a clearly-badged **"Run payout leg (demo)"** button that exercises the real `/trade` + `/fiat/withdraw` calls against PDAX's *own* balance — it prints a permanent **⚠ DEMO PAYOUT** warning on the receipt. Those pesos are not the heir's inheritance. Closing this needs production PDAX credentials on mainnet.

**Cash-in (PHP → crypto) is not implemented.** The button is labelled *Soon*. `POST /fiat/deposit` exists and is documented in [`docs/PDAX_API.md`](docs/PDAX_API.md), but it requires a full BSP travel-rule payload (both parties' legal names, DOB, national ID, addresses) that this app deliberately does not collect.

**Social recovery is guardian designation only — not N-of-M.** Guardians are added as native Stellar signers via `setOptions`, which works. But `setThresholds` is never called, so account thresholds stay at `0/0/0`. **A guardian added today can unilaterally sign any transaction on the owner's account, including locking the owner out.** Wiring thresholds is a small change and is the top correctness item on the list. SEP-30 recoverysigner is not integrated.

**Passkey / smart-account heir login is deferred.** Heirs use a normal Stellar wallet (WalletConnect on mobile). No seed-phrase-free path ships today.

**The NFC card is a pointer, not a signer.** It stores a claim deep-link on a plain NTAG21x tag. It holds no key and signs nothing; secure-element signing (NTAG 424 DNA) is future work. Android Chrome only — Web NFC does not exist on iOS.

**RWA asset card and Sentinel monitor are static stubs**, labelled *Roadmap* in the UI. They display mock data and are wired to nothing.

**Rate source.** Quotes come from PDAX's live `v2/trade/price` when available, fall back to a public spot feed, and only then to a hardcoded constant. The receipt's `provider` field always says which of the three answered, so a public rate is never presented as a venue rate.

## 🔭 Roadmap
Honest about what's vision vs shipped. Today Bequest holds **any Stellar asset** (XLM, USDC, any SAC / SEP-41 token). Beyond that:

- **Cross-chain assets** — let a vault hold and inherit assets from **other chains** (Ethereum/ERC-20, BTC, etc.), not just Stellar-native tokens. Requires a bridge / wrapped-asset layer (e.g. Allbridge, or a custody+attestation model) to represent foreign assets on Stellar. Biggest reach; kept out of the trustless core until a bridge can preserve the "no custodian" thesis.
- **Passkey smart accounts** — heirs claim with fingerprint/face, no wallet app or seed phrase (Stellar passkey-kit + a transaction submitter).
- **PDAX PHP on-ramp** — fund a vault with pesos (PHP→USDC), the mirror of the live off-ramp.
- **RWA asset card** — represent a real-world asset (property, etc.) in the vault. Needs a legal entity + oracle/attestation, so it stays roadmap to avoid reintroducing a custodian.
- **Sentinel monitor** — 24/7 anomaly-detection status light.
- **NFC secure-element signing** — full NTAG 424 DNA cryptographic card (current NFC is a tap-to-claim touchpoint).

## 🎬 Demo

| Item | Link |
|------|------|
| 🔗 Live App | [pamana-sigma.vercel.app](https://pamana-sigma.vercel.app) |
| Demo Video | [Narrated backup video](assets/video/pamana-demo-backup-2026-07-07.mp4) |
| Pitch Deck | [Pitch deck draft](docs/PITCH_DECK.md) |

The stage demo (doc §7) ends on the mic-drop: kill the backend server live, re-run the heir's claim — it still works. The blockchain is the executor.

## 👤 Team
| Name | Role | GitHub |
|------|------|--------|
| Paul Henry Dacalan | Project Lead / Developer · Stellar Ambassador PH | [@polsalarm](https://github.com/polsalarm) |

FEU Institute of Technology.

## 📄 License
MIT
