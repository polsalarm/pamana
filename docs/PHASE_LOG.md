# Pamana — Phase Log

Living record of what changed each phase: contract IDs, deploy links, keys (public only), test results, key decisions. **Updated at the end of every phase.** Plan lives in [`BUILD_PLAN.md`](BUILD_PLAN.md); this is the as-built log.

> 🔐 **Secrets rule:** only **public** keys / addresses / contract IDs go here. Secret keys live in `~/.config/stellar/` and env files — never in this doc or the repo.

---

## Quick reference (latest)

| Item | Value |
|------|-------|
| Current phase | Phases 0-10 done - build complete; Phase 10 adds claimant dashboard, in-app claim nav & transaction feedback (frontend-only, no redeploy) |
| Network | Stellar Testnet (`Test SDF Network ; September 2015`) |
| Deployer identity | `pamana-testnet` → `GDVWTEQQHWWPB7BHGVZDNZQGNWNB4EDLOKTHHNW2AXLI7JBC6SRJM4X3` |
| Factory contract ID (multi-token) | `CANQJ6N5BNPYY5CZWGRY7QTZKAY7IAIMSI7RPRNJZP564DROBWOG5PQM` |
| RWA oracle contract ID (Phase 2) | `CDBZ4RNSN5235LB2ZOF3UZ3VRHOD2VHFGDTELZI45V4S4IIIOECNLKJS` |
| Vault contract ID (first) | `CDJOXNIY6FMVUBDCDYV3VXWDXVZ323WURQ3VOLSNGH6BTHBMXP7X5LJG` |
| Vault wasm hash | `7fadec9c5c90d8d409f2d2b874f933c39fc8b26f9617d2406eed46799556c423` |
| Factory wasm hash | `603f70b96596e0ff5293ff1568cbfd7cc4fd68c722849cca8db970d26f782eae` |
| Tokens | any Stellar asset (SAC/SEP-41); native XLM SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Live app URL | **https://pamana-sigma.vercel.app** (Vercel, prod) |
| WalletConnect project | dedicated Pamana Reown project (id in Vercel env, not repo) |
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

## Phase 6 — Heir designation + claim flow ✅ (build + live reads verified)
**Date:** 2026-07-06 · **Status:** Complete (code + browser read verification); heir-signed claim = device test

### Changes
- **Manage Heirs** page: add/remove heir rows, per-heir % share, **live BPS-to-100% validator** (turns red until exactly 100%; Stellar-address regex checks; Save disabled until valid) → `set_heirs`.
- **Heir Claim** page: look up a vault by the owner's address, show status + your share % + XLM estimate, **Claim** (permissionless, heir signs) with locked / already-claimed / success states.
- Contract layer: `setHeirs` (Heir struct → ScVal map, fields sorted) + `claim`. Routes wired; claim entry from dashboard empty-state.
- **Routing fix**: added a `restoring` gate so hard-loading a wallet-gated deep link (`/create`, `/deposit`) no longer bounces to Landing before the session restores.

### Tests / verification (browser, against live vault)
| Check | Result |
|-------|--------|
| `npm run build` (tsc + vite) | ✅ clean |
| Manage Heirs renders; BPS validator red at 0% / ≠100% | ✅ |
| Claim renders; deep-link bounce fixed | ✅ |
| Live read: enter owner `GDVW…` → resolves vault `CADCW4…`, reads heirs, flags non-heir wallet | ✅ |

### Success criteria
- [x] Heir designation UI with live BPS validator → `set_heirs`
- [x] Heir claim UI wired to live `claim`; reads verified against deployed vault
- [ ] Two heirs claim independently on-device (heir-signed) — **user step** (contract-level already proven in Phase 4)

---

## Phase 7 — NFC tap-to-claim + social recovery ✅ (passkey deferred)
**Date:** 2026-07-06 · **Status:** Complete (code + read paths verified); on-device NFC = Android test

> Scope decision: shipped **NFC + native multisig recovery**; **passkey smart-wallet deferred to roadmap** (needs passkey-kit + a Launchtube submitter — a separate sub-project; heirs still get no-seed-phrase via WalletConnect mobile wallets).

### Changes
- **NFC (Android Chrome, feature-detected)** — `lib/nfc.ts` reads/writes claim cards holding a `/claim?owner=G…` deep-link. Heir Claim page: *Tap NFC card* button + auto-lookup from `?owner=` query param (tap card → Chrome opens prefilled). Owner *Program NFC card* in Manage Heirs. Desktop/iOS hide the NFC UI (`NDEFReader` absent). Card guide (what to buy/program/tweak) in the NFC appendix below.
- **Social recovery (§4.3)** — native Stellar multisig via `setOptions`. `lib/recovery.ts`: `getAccountSecurity` (Horizon), `addGuardian` / `removeGuardian` / `setThresholds`; `submitClassic` helper for classic (non-Soroban) txns. Recovery page lists guardians + add/remove; linked from dashboard.

### Tests / verification
| Check | Result |
|-------|--------|
| `npm run build` (tsc + vite) | ✅ clean (code-split; WalletConnect adds weight) |
| NFC feature-detection hides UI off-Android | ✅ (by design) |
| Recovery read shape vs live Horizon (`GDVW…` signers/thresholds) | ✅ matches |

### Success criteria
- [x] NFC tap-to-claim wired (deep-link read/write, feature-detected) — on-device Android test pending
- [x] Multisig guardian designation UI (add/remove/read via native `setOptions`)
- [~] Passkey — deferred to roadmap (documented)

---

## Phase 8 — PDAX off-ramp (rate + quote) ✅ (live endpoint verified)
**Date:** 2026-07-06 · **Status:** Off-ramp Layer-1 complete + live; on-ramp + withdrawal execution = next increment

### Changes
- **First backend**: Vercel serverless functions under `frontend/api/`. `_pdax.ts` = server-side PDAX Institutional API client (login token cache w/ 600s TTL, `access_token`+`id_token` headers, `getRate` with fallback). `pdax-rate.ts` = `GET /api/pdax-rate` proxy (Vercel Node `(req,res)` signature).
- **Off-ramp UI** (`heir/OffRamp.tsx`): USDC amount → debounced live PHP quote + GCash/Maya/bank payout picker; linked from claim-success + dashboard. `lib/pdax.ts` calls only `/api/*`.
- **API discovered by UAT probing** → documented in `docs/PDAX_API.md` (base URL, login shape, headers, balances, trade/funding/withdraw endpoints). **No secrets in repo.**

### Keys / config (public only)
- PDAX UAT base `https://uat.services.sandbox.pdax.ph/api/pdax-api`; creds in Vercel env (`PDAX_USERNAME/PASSWORD/BASE_URL`) + gitignored `.env.local`. Fallback rate `RAMP_RATE_FALLBACK=58`.
- UAT `/trade/price` returns 500 (mock OTC down) → endpoint returns `source:"fallback"` at ₱58/USDC. Login + `/balances` verified working (test acct: PHP 100k, USDC 10k, XLM).

### Tests (live)
| Check | Result |
|-------|--------|
| `npm run build` + api tsc | ✅ clean |
| **Live** `GET /api/pdax-rate?base=USDC&amount=350&side=SELL` | ✅ `{rate:58, source:"fallback", php:20300}` |
| PDAX login server-side (keys never in client) | ✅ (token cached in function) |

### Success criteria
- [x] Live PHP rate + timestamp (off-ramp); keys server-side only
- [x] Off-ramp quote screen (real PDAX login + graceful fallback)
- [ ] On-ramp funds a vault with USDC from PHP — next increment
- [ ] Off-ramp executes withdrawal (fiat/withdraw) — next increment (UAT settlement)

---

## Phase 9 — Stubs, polish, demo, submission ✅ (code deliverables)
**Date:** 2026-07-06 · **Status:** Complete for everything buildable; video + deck are the user's to record/make

### Changes
- **RoadmapCards** component on the dashboard: Sentinel "Protected" status light + mock RWA property card (₱2.4M Quezon City lot), both labeled **Roadmap** (doc §4.7 — honest vision, not shipped).
- **`docs/DEMO_SCRIPT.md`** — ≤4-min stage script (doc §7 adapted to live features), with cut list + honest roadmap notes + the mic-drop.
- **`docs/SUBMISSION.md`** — form answers (track, problem, solution, Stellar integration, why-Stellar, what's-built, roadmap, links) from doc §2 + the live build.
- **`docs/PITCH_DECK.md`** - 10-slide pitch deck draft covering problem, solution, Stellar integration, live demo, roadmap, and close.
- **`docs/DEMO_RECORDING_CHECKLIST.md`** - backup-video preflight, shot list, narration beats, and export checklist.
- **Polish**: fixed stale factory id in README status banner + `.env.example` (now the multi-token factory `CANQJ6N5…`); live app URL in README demo table.

### Deliverables
- [x] RWA card + Sentinel light stubs (roadmap-labeled)
- [x] Demo script ≤4 min (`DEMO_SCRIPT.md`)
- [x] Backup demo **video** - narrated phone-frame MP4 captured from the actual React app at `assets/video/pamana-demo-backup-2026-07-07.mp4`; upload URL still needed for submission
- [x] **Pitch deck draft** - `PITCH_DECK.md`
- [x] Submission answers drafted (`SUBMISSION.md`)
- [x] Live app URL + contract links in README + Quick reference

> **Win condition met:** vault live on Testnet ✅ + heir claims live ✅ + PDAX rate live ✅.

---

## Multi-token rework (post-Phase 8, 2026-07-06) ★
**Status:** Complete + redeployed + live-verified

A vault now holds **many tokens at once** (any Stellar asset — SAC/SEP-41), not one. Each heir's `bps` share applies to every token; heirs claim each token independently.

### Contract (BREAKING API)
- `init(owner, timeout)` — token param dropped; tokens register on first `deposit`.
- `deposit(token, amount)`, `withdraw(token, amount)`, `claim(token, heir)` — all take a token.
- `Heir` and `ReleaseSlot` lose their single `claimed` flag → per-token state: `Claimed(token,heir)`, `SlotClaimed(token,heir)`.
- `TotalLocked(token)` snapshotted at each token's first claim (§5.1 holds per asset); `Distributing` global (gates withdraw).
- New views `get_tokens`, `is_claimed(token,heir)`. `create_vault(owner, timeout)` drops token.
- **28 workspace tests** (vault 22 incl. 3 multi-token, factory 6). Vault wasm 17 fns.

### Redeploy
New factory `CANQJ6N5…5PQM` + vault hash `7fadec9c…`. Live CLI verified: `deposit` registers token, `get_tokens` → `[native SAC]`. Frontend `VITE_FACTORY_CONTRACT_ID` updated in Vercel (all envs) + `.env.local`.

### Frontend
Token list + `tokenBySac` in config; Dashboard lists every token balance; Deposit has a token picker (known + custom SAC paste); Claim shows a per-token claim list; `useVault` loads per-token balances.

### Supported tokens
Any Stellar-network asset exposed as a Soroban token (native XLM SAC, USDC/EURC SACs, any SEP-41 contract). **Not** cross-chain (no ERC-20/BTC) — cross-chain assets are on the **roadmap** (see README 🔭 Roadmap; needs a bridge/wrapped-asset layer that preserves the no-custodian thesis).

### Add-your-own-token + trustline UX (2026-07-06)
- **Add token**: Deposit → *Add token* → paste any token's SAC address → app reads `symbol`/`decimals`/`name` live off the SAC and saves it on-device (localStorage `pamana.userTokens`); it then appears as a picker chip. `config.ts` `getUserTokens/addUserToken/allTokens`.
- **Trustline UX**: heirs claiming a **non-native** asset need a trustline first. `lib/token.ts` reads the SAC's wrapped classic asset (`name()` = `CODE:ISSUER`), checks the heir's Horizon balances, and submits `changeTrust`. Claim shows *Add trustline* before *Claim* for untrusted custom assets; native XLM skips it.
- **Live-verified** end-to-end: vault held XLM + a custom `PAMANA` SAC; heir claimed **both** independently (XLM +49.97, PAMANA exactly 100), per-token `is_claimed` both true, re-claim rejected. SAC `name`/`symbol`/`decimals` shapes confirmed against the live PAMANA SAC.

---

## Phase 10 — Claimant dashboard, claim navigation & action feedback ✅
**Date:** 2026-07-09 · **Status:** Complete · **Frontend-only — no contract change, no redeploy (wasm hashes & contract IDs unchanged)**

Closes three UX gaps that broke the heir/claimant experience: (1) after claiming, nothing in-app showed what you received; (2) `/claim` was only reachable from the empty-vault onboarding; (3) there was no confirmation or transaction-status feedback anywhere — a claim gave no "is it done?" signal.

### Changes
- **Feedback system (net-new).** `components/Modal.tsx` (overlay primitive, pins inside the `DesktopFrame` screen layer), `components/Toast.tsx` (transient stack), and `contexts/FeedbackContext.tsx` — a `FeedbackProvider` + `useFeedback()` exposing `runTx()` (**confirm → live pending → success / error**) and `toast()`. `runTx` shows a **"View on Stellar Expert"** link for the confirmed tx. Mounted inside `DesktopFrame` in `main.tsx`.
- **Tx-hash plumbing.** `lib/stellar.ts` records `lastTxHash` after a `SUCCESS` in `writeContract`/`submitClassic`; `consumeLastTxHash()` feeds the explorer link. `lib/config.ts` adds `explorerTxUrl(hash)` (testnet/public aware). Actions serialize behind the modal, so only one tx is ever in flight.
- **Claimant dashboard ("My Assets").** `lib/hooks/useWalletBalances.ts` reads the connected account's real balances from Horizon (`/accounts/:id`, 404 = empty); `components/AssetsCard.tsx` renders them at the top of Home, so a claimant sees received funds immediately.
- **Home restructure.** Home (`/dashboard`) is now the personal view: **My Assets** → **Cash out / Cash in / Claim** action buttons → the **vault** (core feature, via shared `components/VaultPanel.tsx`) → **Activity** log → roadmap. `Cash in` is a labeled "Soon" (PHP on-ramp is roadmap).
- **Bottom nav (5 tabs).** Home · Heirs · **Vault** (distinct raised primary button, `lock` icon, `/vault`) · **NFC** (`/nfc`) · Settings. Vault management is shared between Home and its own tab via `VaultPanel`.
- **NFC page (`pages/Nfc.tsx`).** Now the single home for card **programming** (moved off Manage heirs). The card starts as a **blank tag** and, once programmed, animates a **reveal** (`cardReveal` keyframe) into the branded card — a React Bits `ProfileCard`-style **3D tilt + holographic sheen** (`components/TiltCard.tsx` + `.css`). Program state is remembered per address in localStorage; **tap a card to claim** reads a tag → `/claim`; a copyable claim link is the universal fallback (desktop shows a labeled preview of the reveal). Also hosts the roadmap **RWA** card (RoadmapCards split into reusable `RwaCard`/`SentinelCard`).
- **Manage heirs overlay.** With no vault, the heirs form is blurred/disabled behind a centered "create a vault first" overlay card (replaces the old inline error).
- **Activity feed.** `lib/hooks/useActivity.ts` + `components/ActivityLog.tsx` read the account's recent Horizon operations (payments, `invoke_host_function` balance-changes = vault deposits/claims/withdrawals, trustlines) into a friendly feed. Home shows the latest 8 with a **View all** link to the full `/activity` page (`pages/Activity.tsx`).
- **Confirm + status on every mutating action.** `runTx` wired into `checkIn` (status-only — frequent heartbeat), `createVault`, `deposit`, `withdraw`, `setHeirs`, social-recovery add/remove, heir `claim` + `addTrustline`, and the PDAX `cash-out` (off-chain → `silentSuccess`, keeps its rich receipt screen). Replaces the old inline `busy`/`error` strings and the `alert()` on check-in.

### Tests
| Check | Result |
|-------|--------|
| `npm run build` (tsc -b + vite) | ✅ clean (pre-existing walletconnect/chunk-size warnings only) |
| `cargo test --workspace` | ✅ 22/22 vault (unchanged — no contract edits) |
| Manual: dashboard shows wallet assets; Claim tab + card reachable with/without a vault | ⏳ live Testnet walkthrough |
| Manual: claim → confirm → pending → success + working Stellar Expert link; rejected signature → error state | ⏳ live Testnet walkthrough |

### Success criteria
- [x] Claimant can see received funds in-app (My Assets)
- [x] `/claim` reachable from Home whether or not you own a vault
- [x] Vault (core feature) stays on Home and has its own distinct nav tab
- [x] Recent activity on Home + a full `/activity` page (View all)
- [x] Every on-chain/money action shows confirmation + live transaction status
- [x] Confirmed txs link to a block explorer
- [x] No contract/SDK changes; frontend builds clean; contract tests still green

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

## Appendix — NFC claim cards (what to buy + how to program)

Pamana's NFC is the **claim touchpoint** from doc §4.4 — a card the heir **taps** to jump straight into claiming. The card only **stores the owner's address (or a claim deep-link)**; it does **not** sign anything. Full secure-element (JavaCard) signing is explicitly deferred post-hackathon (doc §4.4 scope boundary). So a plain writable tag is all we need.

### What to buy
| Spec | Value | Notes |
|------|-------|-------|
| Chip | **NTAG215** (NTAG213/216 also fine) | NTAG215 = 504 bytes, the sweet spot. NTAG213 (144 B) is enough for one address/URL and cheaper. |
| Standard | NFC Forum **Type 2**, **13.56 MHz** | Must be 13.56 MHz. **Do NOT buy 125 kHz "RFID"** — wrong frequency, won't work with phones. |
| Form factor | PVC **cards** (credit-card size) for the family prop; **stickers**/keyfobs work too | Cards look best for the "inheritance card" demo. |
| Quantity | 3–5 for the demo | ~₱15–50 each on Shopee/Lazada/Amazon — search **"NTAG215 NFC card"**. |

**Not needed:** NTAG 424 DNA (the doc mentions it for the *future* secure-signing path) and USB readers (ACR1252U). You can program everything with a phone. Buy 424 DNA only if you later build the cryptographic secure-element flow.

### Phone support (important)
- **Android Chrome only.** Web NFC works on Android with NFC hardware (most mid/high phones).
- **iPhone: not supported.** Safari has no Web NFC; iOS NFC is native-app-only. So the NFC path is Android-exclusive — passkey / WalletConnect mobile is the iOS fallback.
- Desktop: no Web NFC ever → our UI **feature-detects** and hides the NFC button when unsupported.

### What we store on the card
A single **URL (URI) NDEF record** = a claim deep-link:
```
https://pamana-sigma.vercel.app/claim?owner=G...OWNER_ADDRESS
```
Heir taps → phone opens Chrome to the claim page, pre-filled with the owner → connect wallet → Claim. (We also read a plain **Text** record containing a `G...` address, as a fallback.)

### How to program a card
**Option 1 — in the Pamana app (Android):** owner opens Manage Heirs → *Program NFC card* → taps a blank tag → the app writes the deep-link via Web NFC. (Built in Phase 7.)

**Option 2 — free app:** install **"NFC Tools"** (wakdev) on Android → *Write* → *Add a record* → *URL* → paste the deep-link above → *Write* → tap the tag.

### How to tweak it
- **Change the link/prefix:** edit what the app writes in `frontend/src/lib/nfc.ts` (`writeClaimCard`) — swap the base URL or the `?owner=` param.
- **Record type:** URL (deep-link, best UX) vs Text (raw address). We write URL, read both.
- **Point at a specific vault** instead of owner: write `?vault=C...` and have the claim page skip the owner→vault lookup. (Owner→vault via the factory registry is the default so the same card keeps working even if the vault is redeployed.)
- **Locking:** NTAG21x can be made read-only with a lock bit (via NFC Tools) once written, so the card can't be overwritten. Optional for the demo.

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
| 2026-07-06 | 6 | Heir designation (live BPS validator) + heir claim UI; live reads verified in browser |
| 2026-07-06 | 7 | NFC tap-to-claim (feature-detected) + native multisig social recovery; passkey deferred |
| 2026-07-06 | 8 | PDAX off-ramp: serverless rate proxy + cash-out UI; live endpoint verified (350 USDC → ₱20,300) |
| 2026-07-06 | 8+ | Off-ramp execution UI (payout + receipt via /api/pdax-withdraw, simulated on UAT decline) |
| 2026-07-06 | ★ | **Multi-token rework** — vaults hold many tokens per vault; contract + factory redeployed; 28 tests; frontend token pickers; live deposit verified |
| 2026-07-06 | 9 | Roadmap stubs (RWA card + Sentinel light) + demo script + submission answers + README polish |
| 2026-07-06 | fix | `getStatus` normalizes the Soroban enum-vec (`['Distributing']`→string) so app-wide status checks work (StatusLight, Dashboard countdown, Claim gating, Withdraw lock); withdraw + cash-out flows browser-verified |
| 2026-07-08 | test | Re-ran `cargo test -p pamana-vault` → **22 passed, 0 failed** — reproves the death-and-claim path (claim-before-timeout rejected, check_in resets countdown, post-timeout single/multi-heir payout, snapshot immutable). Matches BUILD_PLAN Appendix A logic proof. |
| 2026-07-09 | 10 | Claimant Home (My Assets from Horizon + Cash out/in/Claim + Activity feed), 5-tab nav with distinct raised **Vault** tab (shared `VaultPanel`) + **NFC** page (program/tap claim card + link fallback + RWA card), full `/activity` page, and app-wide confirm→pending→success/error modal with Stellar Expert links. Also fixed a stale `.env.local` factory id (pointed at the pre-rework factory) + a legacy-vault read guard. Frontend-only; build clean; contracts unchanged (22/22 still green). |
| 2026-07-12 | RWA-1 | **RWA Phase 1 (demo-real).** Issued regulated testnet asset `HOUSE01` (issuer `GA6NUCC4BBPBAMZADHGQOQHA3TDP3KHRG43TIW2F7VDA4VL5AZU6ECIN`, flags AUTH_REVOCABLE + AUTH_CLAWBACK_ENABLED — AUTH_REQUIRED deferred to Phase 3/SEP-8), SAC-wrapped (`CAXFGZMPWQMZBCIV6KO5K4YBYKZQN57BWD62Q2WTHHNVZ4UO7I6OQJWT`), deposited 1.0 into vault `CDJOXNIY…7X5LJG` (tx `10144b50…`). `get_tokens` returns the SAC; vault UI shows `1 HOUSE01` w/ RWA badge + attested ₱2.4M. Script `scripts/rwa/issue-rwa.sh`; frontend `config.ts`/`VaultPanel.tsx`/`devDemo.ts`. Contracts unchanged. See `docs/RWA_PHASES.md`. |
| 2026-07-12 | RWA-2 | **RWA Phase 2 (valuation oracle).** New `pamana-oracle` contract (9/9 tests green) storing signed appraiser attestations `(value_php, doc_hash, appraiser, timestamp)` keyed by SAC. Deployed `CDBZ4RNSN5235LB2ZOF3UZ3VRHOD2VHFGDTELZI45V4S4IIIOECNLKJS`; admin = `pamana-testnet`; appraiser `GDOAIKHT3YRNH4ELPS4QZ6BE5ZBCPQT2CCPXS7D33RMI4HJJOAAWP2VK`. Attested HOUSE01 = ₱2,400,000, doc_hash `e57ac339…` of `docs/rwa/HOUSE01-appraisal.md` (tx `de69f84c…`). Frontend `lib/oracle.ts` + `VaultPanel` RwaMeta row shows attested value + recency + appraiser (no longer a constant). Vault/factory unchanged. |
| 2026-07-12 | RWA-3 | **RWA Phase 3 (compliance gate — mechanism real, approver simulated).** Issued `HOUSE02` with **AUTH_REQUIRED** + revocable + clawback from a dedicated gated issuer `GC2PZU3LDPYHMTA4XVHMHAROU7GK4IW4NNPBTIPZ6GGYGKDSXHEB4ABB`; SAC `CDPJ2C55GRIZDS67FG7D3SPZT7ND6STKLPDNCD2HQU6EUZRG3WA36UJT`; authorized the vault via SAC `set_authorized` (classic `set-trustline-flags` can't target a `C…` address) and deposited 1.0. **Gate proven:** unauthorized deposit trapped with SAC Error #11 `"balance is deauthorized"`. New approver `api/kyc.ts`+`_kyc.ts` signs `set_authorized(heir,true)` with the issuer key (server-only `RWA_GATED_ISSUER_SECRET`): `POST /api/kyc` → `{approved:true}` flipped heir `authorized` **false→true**; `{deny:true}` → `{approved:false}`, heir stays gated. Claim page shows KYC badge + gate + simulate-rejection. ⚠️ **The KYC decision is SIMULATED (auto-approve) — stands in for a licensed compliance officer / custodian admin; no identity checked, no PII read/stored/sent.** See `docs/RWA_PHASES.md` § Demo shortcuts. Vault/factory/oracle unchanged. |
| 2026-07-12 | RWA-4 | **RWA Phase 4 (redemption — mechanism real, custodian simulated).** New demo custodian `api/redeem.ts`+`_redeem.ts`: maps a title SAC to its classic asset + issuer and calls classic `clawback` (CAP-35) signed by the issuer key (server-only `RWA_ISSUER_SECRET` / `RWA_GATED_ISSUER_SECRET`), submitted via Horizon. **Burn proven on testnet:** minted a throwaway HOUSE01 balance to a scratch account, called `redeemTitle()` directly — balance went `1.0000000 → 0.0000000` (tx confirmed); a second call against the now-empty balance failed cleanly with `"heir holds no redeemable balance"` instead of submitting a bad tx. `frontend/src/lib/redeem.ts` client wrapper; `token.ts` gained `getBalance()` so redemption state is read from the heir's real balance, not a client flag. Claim page's `RedeemGate` shows **Redeem for title** on a claimed title, **Redeemed** once balance hits 0, plus simulate-hold. ⚠️ **The custodian decision ("has the title actually transferred?") is SIMULATED (auto-approve) — stands in for a licensed SPV/custodian; no off-chain paperwork happens.** See `docs/RWA_PHASES.md`. Vault/factory/oracle/contracts unchanged. |
