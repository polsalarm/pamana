# 🪙 Pamana

**Your pamana moves on its own.**
Trustless on-chain inheritance for Filipino families — built on Stellar & Soroban.

> Rise In × Stellar APAC Hackathon 2026 · Track: **Local Finance & Real World Access** · Deadline: **2026-07-15**
> Paul Henry Dacalan · FEU Institute of Technology

---

## What it is

Pamana is a self-custody Stellar wallet with inheritance enforced **entirely on-chain** by a Soroban smart contract — no company, no lawyer, no legal trust required for the inheritance to fire.

The owner periodically calls `check_in()` to prove they're alive, resetting a countdown. If they go silent past the timeout, designated heirs claim their share directly from the contract.

> **If our app, our company, and all our servers disappear, your family still inherits. The Stellar ledger is the executor.**

Unlike existing "crypto inheritance" products that reintroduce a custodian (off-chain company + foreign legal entity), Pamana builds the inheritance logic into the blockchain itself.

## Core features

| Pillar | What it does |
|--------|--------------|
| Trustless Inheritance | Soroban heartbeat vault — heirs claim after a proof-of-life timeout |
| Multi-Heir BPS Splits | Basis-point splits, pull-based, independent claims |
| Social Recovery | Native Stellar multisig + SEP-30 guardians |
| NFC Claim Card | Tap-to-claim on Android for non-crypto-native heirs |
| Time-Locked Release | Trust-fund style scheduled disbursement |
| PDAX On/Off-Ramp | BSP-licensed PHP ⇄ USDC conversion |

## Architecture

| Layer | Technology |
|-------|-----------|
| Smart contracts | Soroban (Rust) — factory + vault |
| Asset | USDC via Stellar Asset Contract (SAC) |
| Frontend | React 19 + Vite + Tailwind |
| Auth / signing | Freighter wallet · passkeys / smart accounts |
| On/Off-ramp | PDAX API (PHP ⇄ USDC) |
| NFC | NTAG 424 DNA card + Web NFC API |
| Network | Stellar Testnet |

## Repository structure

```
contracts/
  pamana-factory/    deploys + registers an isolated vault per family
  pamana-vault/      heartbeat, heir BPS splits, pull-based claims, TTL mgmt
frontend/            React/Vite app (owner + heir flows)
docs/                build plan, resources, architecture, demo script
spec/                specifications
UI/                  design mockups
Pamana-Full-Document.md   full project document (source of truth)
```

## Status

Planning complete → building. See [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md) for the phased build order and [`docs/STELLAR_DEVELOPER_RESOURCES.md`](docs/STELLAR_DEVELOPER_RESOURCES.md) for developer links.

## License

TBD.
