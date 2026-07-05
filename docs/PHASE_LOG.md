# Pamana — Phase Log

Living record of what changed each phase: contract IDs, deploy links, keys (public only), test results, key decisions. **Updated at the end of every phase.** Plan lives in [`BUILD_PLAN.md`](BUILD_PLAN.md); this is the as-built log.

> 🔐 **Secrets rule:** only **public** keys / addresses / contract IDs go here. Secret keys live in `~/.config/stellar/` and env files — never in this doc or the repo.

---

## Quick reference (latest)

| Item | Value |
|------|-------|
| Current phase | ✅ Phases 0–5 done → ▶ Phase 6 next (heir designation + claim UI) |
| Network | Stellar Testnet (`Test SDF Network ; September 2015`) |
| Deployer identity | `pamana-testnet` → `GDVWTEQQHWWPB7BHGVZDNZQGNWNB4EDLOKTHHNW2AXLI7JBC6SRJM4X3` |
| Factory contract ID | `CAMKUFDTTIVDL4Z2UV6UISUDGSONOCCEZHTYH3EFTIA2ILSLLKV4F5RH` |
| Vault contract ID (first) | `CADCW4D7PHXCWJ4VDEGPMMB37T4UXPKAMOB5XUZM4KGI7JW6QO4AAQQ4` |
| Vault wasm hash | `32c5a1599ac5b0eb7e1b014ebe3e28b51f7704891af2a6fb94f5ea0393078f0f` |
| Factory wasm hash | `4b500598db3ab6ba1ee80dbeadfd8a845ddf83ad7e271ca4c14971ddbc565607` |
| Token (native XLM SAC, testnet) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Live app URL | TBD |
| soroban-sdk | 22.x · target `wasm32v1-none` · stellar-cli 25.2.0 |

---

## Phase 0 — Tooling & scaffold ✅
**Date:** 2026-07-06 · **Status:** Complete

### Changes
- `contracts/` converted to a cargo **workspace** — root `Cargo.toml` (release profile tuned for small wasm) with members `pamana-vault` + `pamana-factory`.
- `pamana-vault` + `pamana-factory` = minimal `version() -> 0` skeletons that compile clean. Old PalengkePay payment template code + stale test snapshots removed.
- `frontend/` scaffolded: Vite 6 + React 19 + TypeScript 5 + Tailwind v4 (`@tailwindcss/vite`). `main.tsx`, `App.tsx` (landing placeholder), `.env.example`.
- `.gitignore` extended (`*.tsbuildinfo`). Lockfiles committed.
- Toolchain + identity documented in [`contract-deployment.md`](contract-deployment.md).

### Toolchain (verified)
| Tool | Version |
|------|---------|
| Node.js | 24.14.1 |
| Rust / cargo | 1.94.1 |
| stellar-cli | 25.2.0 |
| Build target | `wasm32v1-none` |
| soroban-sdk | 22.x |

### Build artifacts (wasm hashes)
| Contract | Wasm hash |
|----------|-----------|
| pamana_vault.wasm | `9c6492048f8310aeac1078c5bbc61449e2ff599dd3a5ad721b9b16cc544ae433` |
| pamana_factory.wasm | `14fde08027676c63c11e04751ecc421ad97d2fcc8ff07c61f00daa4904443254` |

### Keys / identities
| Alias | Address | Notes |
|-------|---------|-------|
| `pamana-testnet` | `GDVWTEQQHWWPB7BHGVZDNZQGNWNB4EDLOKTHHNW2AXLI7JBC6SRJM4X3` | Funded via Friendbot. Secret in `~/.config/stellar/`. |

### Tests
| Suite | Result |
|-------|--------|
| `cargo build` / `stellar contract build` | ✅ both crates → wasm |
| `npm run build` (frontend) | ✅ clean (196 kB / 61 kB gz) |

### Success criteria — all met ✅
- [x] Both contracts compile to wasm
- [x] Frontend builds / dev-serves
- [x] Funded Testnet account exists
- [x] SDK pinned + documented

---

## Phase 1 — Vault core: heartbeat + single-heir claim ✅
**Date:** 2026-07-06 · **Status:** Complete

### Changes
- `pamana-vault` implemented: `types.rs` (Heir, VaultStatus, DataKey, Error enum) + full `lib.rs`.
- Persistent storage with TTL bump on every mutation (§5.2 archival guard); permissionless `bump()` keepalive.
- Vault wasm: 10 516 bytes, **13 exported functions**.

### Contract functions added
`init` · `deposit` · `check_in` · `set_heirs` · `claim` · `withdraw` · `bump` · views (`get_status`, `get_heirs`, `get_owner`, `get_heartbeat`, `get_timeout`)

### Tests (part of the 16-test suite)
| Test | Result |
|------|--------|
| init sets owner + Alive status | ✅ |
| double init fails | ✅ |
| deposit moves funds into vault | ✅ |
| deposit zero rejected | ✅ |
| claim before timeout rejected | ✅ |
| check_in resets countdown | ✅ |
| single heir claims full balance | ✅ |
| double-claim (single heir) rejected | ✅ |
| withdraw returns funds to owner | ✅ |

### Success criteria — all met ✅
- [x] Unit tests green (deposit, timeout gate, single-heir payout)

---

## Phase 2 — Multi-heir BPS + TotalLocked snapshot ✅
**Date:** 2026-07-06 · **Status:** Complete

> Built together with Phase 1 — the `TotalLocked` snapshot lives inside the `claim` path and cannot be cleanly separated. ⚠ highest-risk logic (§5.1).

### Changes
- `set_heirs` validates `sum(bps) == 10_000` and rejects otherwise; empty list rejected.
- Pull-based independent claims; `claim` snapshots the full balance into `TotalLocked` on the **first** claim and pins `Distributing = true`; later heirs compute against the snapshot, never the shrinking live balance.
- Double-claim guard per heir (`claimed` flag).

### Tests
| Test | Result |
|------|--------|
| bps sum ≠ 10000 rejected | ✅ |
| empty heir list rejected | ✅ |
| 7000/3000 correct, order A→B | ✅ (700 / 300) |
| 7000/3000 correct, order B→A | ✅ (700 / 300) |
| snapshot immutable after first claim | ✅ |
| unknown claimant rejected | ✅ |
| withdraw blocked after distribution starts | ✅ |

**Full suite: `cargo test -p pamana-vault` → 16 passed, 0 failed.**

### Success criteria — all met ✅
- [x] 7000/3000 heirs correct in either claim order
- [x] bps≠10000 rejected
- [x] double-claim rejected
- [x] snapshot immutable after first claim

---

## Phase 3 — Schedule + bump + withdraw ✅
**Date:** 2026-07-06 · **Status:** Complete

> `bump` + `withdraw` already shipped in Phase 1; Phase 3 delivers the trust-fund release schedule.

### Changes
- `ReleaseSlot { unlock_time, bps, claimed }` type + `DataKey::Schedule(Address)`.
- `set_schedule(heir_addr, slots)` — owner-only; rejects unknown heir + slot bps sum ≠ 10 000.
- `claim` is now schedule-aware: a scheduled heir releases **one matured tranche per call** (`NothingMatured` until `unlock_time`); heir marked fully `claimed` only when every slot is drained. Lump-sum heirs unchanged.
- `get_schedule` view. Vault wasm now 13 562 bytes, **15 exported functions**.

### Tests
| Test | Result |
|------|--------|
| set_schedule rejects unknown heir | ✅ |
| set_schedule rejects bad bps sum | ✅ |
| scheduled heir releases in tranches (300 → 600), premature = NothingMatured | ✅ |
| drained schedule → AlreadyClaimed; lump-sum heir unaffected (400) | ✅ |
| schedule stored + readable | ✅ |

**Full suite: `cargo test -p pamana-vault` → 20 passed, 0 failed.**

### Success criteria — all met ✅
- [x] Full vault suite green
- [x] mature tranche claimable / immature rejected (`NothingMatured`)
- [x] withdraw blocked after first claim (Phase 2)

---

## Phase 4 — Factory + Testnet deploy ✅
**Date:** 2026-07-06 · **Status:** Complete

### Changes
- `pamana-factory` implemented: deploys a fresh `PamanaVault` per family via `env.deployer()` with a **deterministic per-owner salt** (sha256 of owner xdr), initializes it through a cross-contract `invoke_contract` call, records an owner→vault registry. `init` / `create_vault` / `get_vault` / `get_admin` / `get_wasm_hash`.
- One vault per owner (`VaultExists` guard). Vault `types` module made `pub` for client bindings.
- Solved the cdylib `init`-symbol clash by invoking the vault by symbol instead of depending on the vault crate.
- Factory wasm: 3 210 bytes, 6 exported functions.

### Deploys / IDs
| Contract | Testnet ID | Explorer |
|----------|-----------|----------|
| PamanaFactory | `CAMKUFDTTIVDL4Z2UV6UISUDGSONOCCEZHTYH3EFTIA2ILSLLKV4F5RH` | [→](https://stellar.expert/explorer/testnet/contract/CAMKUFDTTIVDL4Z2UV6UISUDGSONOCCEZHTYH3EFTIA2ILSLLKV4F5RH) |
| PamanaVault (first, via factory) | `CADCW4D7PHXCWJ4VDEGPMMB37T4UXPKAMOB5XUZM4KGI7JW6QO4AAQQ4` | [→](https://stellar.expert/explorer/testnet/contract/CADCW4D7PHXCWJ4VDEGPMMB37T4UXPKAMOB5XUZM4KGI7JW6QO4AAQQ4) |

Token = native XLM SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`. Full deploy sequence in [`contract-deployment.md`](contract-deployment.md).

### Tests — unit (6) + live Testnet end-to-end
| Check | Result |
|-------|--------|
| init stores admin + wasm hash | ✅ |
| double init fails | ✅ |
| create_vault deploys + initializes a real vault | ✅ |
| two owners → isolated vaults | ✅ |
| duplicate vault for owner rejected | ✅ |
| full inheritance flow through factory-deployed vault (unit) | ✅ |
| **Testnet:** create_vault → deposit 100 XLM → set_heirs → check_in → status `Alive` | ✅ |
| **Testnet:** wait 70s → status `TimedOut` → claim → heir 10000→**10100 XLM** → status `Distributing` | ✅ |

**Workspace: `cargo test --workspace` → 26 passed (20 vault + 6 factory).**

### Success criteria — all met ✅
- [x] Factory deploys a working vault in one call
- [x] Two owners → two isolated vaults
- [x] CLI end-to-end (create→deposit→check_in→claim) passes on Testnet
- [x] Contract IDs recorded (this log + `contract-deployment.md`)

---

## Phase 5 — Frontend foundation ✅ (build-complete; device test pending)
**Date:** 2026-07-06 · **Status:** Complete (code) — live Android wallet test is the user's step

### Changes
- Mobile-first React 19 + Vite + Tailwind v4 app, wired to the **live Phase 4 factory** (`CAMKUF…`) on Testnet.
- **Design**: imported the Stitch "Pamana On-Chain Inheritance Vault" project (Heritage Protocol theme) → design tokens in `index.css` (emerald `#003527`/`#064e3b`, amber `#fea619`, cream `#faf9f6`, Inter), status-light heartbeat motif, logo. Reference HTML saved in `docs/design/stitch/`.
- **Wallet**: Stellar Wallets Kit v2.5 (static API) — Freighter (desktop) + LOBSTR (Android) + xBull + Albedo via `authModal`.
- **Contract layer** (`stellar-sdk` 16): reads via `simulateTransaction`, writes via prepare → sign (kit) → send → poll.
- **Pages**: Landing/connect · Owner Dashboard (status light + day countdown + balance + heirs + check-in) · Create Vault (timeout presets) · Deposit. Router with wallet gating + bottom nav. Placeholders for heirs/withdraw (Phase 6).

### Tests
| Check | Result |
|-------|--------|
| `npm run build` (tsc + vite) | ✅ clean, 558 modules |
| dev server serves app shell | ✅ HTTP 200 |
| live wallet connect + create/deposit/check-in on Android | ⏳ user device test |

### Success criteria
- [x] Code wired to live contracts: connect → create vault → deposit → status light + countdown → check-in
- [x] Builds + serves clean
- [ ] On-device Android verification (owner flow end-to-end) — **user step**

---

## Phase 6 — Heir designation + claim flow ⬜
**Date:** — · **Status:** Not started

### Success criteria
- [ ] Full flow on Testnet with 5-min demo timeout
- [ ] Two heirs claim independently, correct amounts

---

## Phase 7 — Passkey heir path + NFC + recovery ⬜
**Date:** — · **Status:** Not started

### Success criteria
- [ ] Heir claims via passkey (no seed phrase)
- [ ] NFC tap on Android triggers claim
- [ ] Multisig guardian designation UI (stretch)

---

## Phase 8 — PDAX on- & off-ramp ⬜
**Date:** — · **Status:** Not started

### Keys / config (public only)
- _PDAX integration notes, rate fallback, payout methods_

### Success criteria
- [ ] Live PHP rate + timestamp both directions
- [ ] On-ramp funds a vault with USDC from PHP
- [ ] Off-ramp executes withdrawal
- [ ] Keys server-side only

---

## Phase 9 — Stubs, polish, demo, submission ⬜
**Date:** — · **Status:** Not started

### Deliverables
- [ ] RWA card + Sentinel light stubs
- [ ] Demo ≤4 min + backup video
- [ ] Pitch deck
- [ ] Submission form (from doc §2)
- [ ] Live app URL + demo links added to Quick reference

---

## Appendix — Contract source layout (`lib.rs` vs `types.rs`)

The vault crate is split into two source files purely for organization. They compile into **one** crate → **one** wasm.

| File | Role | Contains |
|------|------|----------|
| `types.rs` | **Data contract** — the shapes, no behavior | `Heir`, `ReleaseSlot` structs · `DataKey` storage-key enum · `VaultStatus` enum · `Error` enum. Marked `#[contracttype]` / `#[contracterror]` so they serialize across the Soroban host boundary and appear in the generated client bindings the frontend imports. |
| `lib.rs` | **Behavior** — the logic | The `#[contract] PamanaVault` struct + `#[contractimpl]` methods (`init`, `deposit`, `check_in`, `set_heirs`, `set_schedule`, `claim`, `bump`, `withdraw`, views), TTL helper, constants. Declares `mod types;` and uses those types. |

**Why separate:** `types.rs` = *what data looks like*, `lib.rs` = *what the contract does*. Keeps the logic file readable; the data model can be referenced/changed without wading through function bodies. Standard Rust module split — nothing Soroban-specific about it.

### Does the split affect the deployed contract ID? **No.**
- **Contract ID** is derived at **deploy time** from the deployer account address + a salt (via `stellar contract deploy`). It has nothing to do with how the source is organized.
- **Wasm hash** is derived from the **compiled bytes**. Splitting one file into two (or merging them back) produces byte-identical wasm as long as the *code* is unchanged → identical hash.
- So file organization is invisible after `cargo build`. The ID only ever changes because you **redeploy** (new salt/deployer) or because the **logic changed** (new wasm to install). Moving code between `lib.rs` and `types.rs` does neither.

> Rule of thumb: contract ID tracks *deploys*, wasm hash tracks *code*, source files track *your sanity*.

---

## Change history
| Date | Phase | Summary |
|------|-------|---------|
| 2026-07-06 | 0 | Workspace + frontend scaffold, funded testnet identity, toolchain pinned |
| 2026-07-06 | 1 | Vault core: init/deposit/check_in/set_heirs/claim/withdraw/bump + views |
| 2026-07-06 | 2 | Multi-heir BPS validation + TotalLocked snapshot; 16/16 tests green |
| 2026-07-06 | 3 | Trust-fund release schedule (ReleaseSlot, tranches); 20/20 tests green |
| 2026-07-06 | 4 | Factory deploy per-owner vaults; deployed to Testnet; live claim verified (+100 XLM) |
| 2026-07-06 | 5 | Mobile-first frontend (Stitch Heritage theme) wired to live factory; builds clean |
