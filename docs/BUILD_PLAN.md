# Pamana — Build Plan

**Trustless on-chain inheritance on Stellar / Soroban.**
Rise In × Stellar APAC Hackathon 2026 · Track: Local Finance & Real World Access · Deadline **2026-07-15** · Paul Henry Dacalan (FEU Institute of Technology).

Source of truth: `Pamana-Full-Document.docx` (§1–10). This plan operationalizes it.

---

## Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Contract shape | **Factory + vault** from the start — factory stamps out one isolated vault per family |
| 2 | Off-chain backend | **Defer**; use **Supabase** (not Firebase) only if/when heir contacts + reminders are wired |
| 3 | Heir no-seed login | **Passkey / smart-account first**; add Web3Auth fallback only if a phase has slack |
| 4 | PDAX on- & off-ramp | **Full flow, both directions** (production keys available): on-ramp PHP→USDC to fund a vault, off-ramp USDC→PHP for heirs. Layer-1 public rate pull stays as fallback |
| 5 | NFC claim card | **Committed** (Android device confirmed): Web NFC API tap-to-claim; passkey login is the parallel path for non-Android |
| 6 | Page role naming | Rename skeleton `admin/customer/vendor` → **owner / heir / landing** |

**Win condition (doc §8 cut line):** vault contract live on Testnet + PDAX rate pull + heir claims on stage. Everything else is enhancement or honest stub (RWA card, Sentinel light).

---

## Project structure

```
pamana/
├─ contracts/
│  ├─ pamana-vault/            ← the inheritance vault (one instance per family)
│  │  ├─ Cargo.toml
│  │  └─ src/{lib.rs, types.rs, test.rs}
│  ├─ pamana-factory/          ← deploys + registers vaults per owner
│  │  ├─ Cargo.toml
│  │  └─ src/{lib.rs, test.rs}
│  ├─ Cargo.toml               ← workspace root (both members)
│  └─ README.md
├─ frontend/
│  ├─ src/
│  │  ├─ lib/
│  │  │  ├─ stellar.ts         ← RPC, tx build/sign/submit
│  │  │  ├─ contract.ts        ← typed vault + factory bindings
│  │  │  ├─ pdax.ts            ← rate feed + withdraw
│  │  │  ├─ auth.ts            ← passkey / smart account (Web3Auth stretch)
│  │  │  ├─ nfc.ts             ← Web NFC read (stretch)
│  │  │  └─ hooks/             ← useVault, useHeartbeat, useClaim, useFactory
│  │  ├─ contexts/             ← WalletContext, VaultContext
│  │  ├─ components/           ← StatusLight, CountdownCard, BpsSplitEditor, HeirRow…
│  │  ├─ pages/
│  │  │  ├─ owner/             ← create-vault, deposit, heirs, schedule, check-in, recovery
│  │  │  ├─ heir/              ← claim, nfc-claim, offramp
│  │  │  └─ landing/
│  │  └─ assets/
│  ├─ api/                     ← serverless: pdax proxy (keys), sep10 if needed
│  └─ (vite / tsconfig / tailwind / eslint configs)
├─ docs/
│  ├─ STELLAR_DEVELOPER_RESOURCES.md   ✓
│  ├─ BUILD_PLAN.md                    ← this file
│  ├─ ARCHITECTURE.md
│  ├─ CONTRACT_SPEC.md
│  └─ DEMO_SCRIPT.md                   ← from doc §7
├─ spec/
└─ Pamana-Full-Document.docx / .md
```

---

## Phased build order

Contracts fully built + deployed before the frontend consumes them. Phases 1–4 = doc Week 1; 5–7 = Week 2; 8–9 = Week 3.

### Phase 0 — Tooling & scaffold  (Day 1)
- **Tasks**: verify Rust + `wasm32-unknown-unknown`, Stellar CLI, Node. Restructure `contracts/` into workspace with `pamana-vault` + `pamana-factory` members (rename existing `pamana-payment`). Scaffold Vite + React 19 + TS + Tailwind in `frontend/`. Create + fund a Testnet identity (Friendbot). Confirm Soroban SDK version vs current CLI.
- **Files**: `contracts/Cargo.toml`, `contracts/pamana-vault/Cargo.toml`, `contracts/pamana-factory/Cargo.toml`, `frontend/package.json`, `frontend/vite.config.ts`, `.env.example`.
- **Success**: `cargo build` compiles both crates to wasm; `npm run dev` serves blank app; funded Testnet account exists; SDK version pinned + documented.

### Phase 1 — Vault core: heartbeat + single-heir claim  (W1)
- **Tasks**: `init`, `deposit`, `check_in`, `set_heirs` (single), `claim` (timeout gate), views (`get_status`, `get_heartbeat`, `get_timeout`). TTL bump on init/check_in.
- **Files**: `pamana-vault/src/types.rs`, `pamana-vault/src/lib.rs`.
- **Success**: unit tests green — deposit works; claim rejected before timeout; claim succeeds after; single heir gets full balance.

### Phase 2 — Multi-heir BPS + TotalLocked snapshot  (W1) ⚠ highest-risk logic
- **Tasks**: `set_heirs` enforces `sum(bps) == 10_000` (reject otherwise); pull-based independent claims; **snapshot TotalLocked on first `claim()`** (doc §5.1); mark heir claimed; double-claim guard.
- **Files**: `pamana-vault/src/lib.rs`, `pamana-vault/src/test.rs`.
- **Success**: 7000/3000 heirs get correct amounts in **either** claim order; bps≠10000 rejected; double-claim panics; snapshot immutable after first claim.

### Phase 3 — Schedule + bump + withdraw  (W1)
- **Tasks**: `set_schedule` (per-heir `ReleaseSlot` tranches), schedule-aware claim, permissionless `bump()`, owner `withdraw` (blocked once distributing).
- **Files**: `pamana-vault/src/lib.rs`, `pamana-vault/src/test.rs`.
- **Success**: full vault test suite green; mature tranche claimable, immature rejected; withdraw blocked after first claim.

### Phase 4 — Factory + Testnet deploy  (W1 end)
- **Tasks**: `pamana-factory` — `create_vault(owner, token, timeout)` deploys a vault instance (Soroban deployer), stores `owner → vault_address` registry, `get_vault(owner)` view. Upload vault wasm, deploy factory, wire wasm hash. Deploy both to Testnet.
- **Files**: `pamana-factory/src/lib.rs`, `pamana-factory/src/test.rs`, `docs/contract-deployment.md`.
- **Success**: factory deploys a working vault via one call; two owners get two isolated vaults; contract IDs recorded; manual CLI end-to-end (create → deposit → check_in → claim) passes on Testnet.

### Phase 5 — Frontend foundation  (W2)
- **Tasks**: Freighter connect; `stellar.ts` + `contract.ts` bindings; create-vault via factory; deposit UI; live status light (Alive/Unlocked) + countdown; check-in button.
- **Files**: `lib/stellar.ts`, `lib/contract.ts`, `contexts/WalletContext.tsx`, `contexts/VaultContext.tsx`, `pages/owner/*`, `components/StatusLight.tsx`, `components/CountdownCard.tsx`.
- **Success**: owner connects wallet, creates a vault, deposits USDC, sees balance + status; check-in updates on-chain heartbeat (verified in Stellar Expert).

### Phase 6 — Heir designation + claim flow  (W2)
- **Tasks**: BPS split editor (live sum-to-10000 validation, reject bad split in UI); `set_heirs`; schedule editor; heir claim page.
- **Files**: `components/BpsSplitEditor.tsx`, `components/HeirRow.tsx`, `pages/owner/heirs.tsx`, `pages/owner/schedule.tsx`, `pages/heir/claim.tsx`, `lib/hooks/useClaim.ts`.
- **Success**: full flow on Testnet with 5-min demo timeout — set heirs, wait timeout, two heirs claim independently, correct amounts land, visible in explorer.

### Phase 7 — Passkey heir path + NFC + recovery  (W2)
- **Tasks**: passkey / smart-account heir login (no seed phrase) → claim; **Web NFC tap-to-claim on Android** (committed); Stellar multisig guardian designation UI (SEP-30 optional). Web3Auth fallback only if slack.
- **Files**: `lib/auth.ts`, `lib/nfc.ts`, `pages/heir/claim.tsx` (passkey path), `pages/heir/nfc-claim.tsx`, `pages/owner/recovery.tsx`.
- **Success**: heir claims via passkey with no seed phrase; NFC tap on Android reads claim credential and triggers `claim()`.

### Phase 8 — PDAX on- & off-ramp (full flow)  (W3)
- **Tasks**: **On-ramp** PHP→USDC — owner funds a vault with pesos (GCash/Maya/bank → USDC deposit). **Off-ramp** USDC→PHP — heir converts claimed USDC to pesos + withdraws. Layer 1: live public rate + quote screen (always works). Layer 2: authenticated quote → confirm → execute, both directions, via serverless proxy holding keys.
- **Files**: `lib/pdax.ts`, `frontend/api/pdax-rate.ts`, `frontend/api/pdax-onramp.ts`, `frontend/api/pdax-offramp.ts`, `pages/owner/onramp.tsx`, `pages/heir/offramp.tsx`.
- **Success**: live PHP rate + timestamp shown both directions; on-ramp funds a vault with USDC from PHP; off-ramp executes withdrawal to a payout method; keys never touch the client.

### Phase 9 — Stubs, polish, demo, submission  (W3 end)
- **Tasks**: stub RWA asset card + Sentinel green light; demo rehearsal ≤4 min; record backup video; "kill server, claim still works" mic-drop (doc §7 step 7); pitch deck (§1–3 + §7); fill submission form from §2.
- **Success**: clean full run incl. mic-drop; backup video recorded; submission drafted.

---

## Cut line (if behind in W3)
Safe to cut: stub features (RWA card, Sentinel), trust-fund schedule UI, NFC (fall back to passkey only), factory frontend (deploy one vault manually for demo). **Never cut**: vault on Testnet + PDAX rate + heir claims on stage.

---

## Technical risks

| Risk | Level | Mitigation |
|------|-------|-----------|
| TotalLocked snapshot math (§5.1) | HIGH | Snapshot before any transfer on first claim; dedicated Phase 2 tests |
| Soroban TTL archival (§5.2) | MED | Bump TTL > timeout on check_in; permissionless `bump()`; document long-schedule restoration assumption |
| Factory adds build/test surface | MED | Vault fully done + tested before factory (Phase 4); factory can be cut from frontend for demo |
| Soroban SDK version drift (Cargo pins 22.0.0) | MED | Confirm vs current CLI in Phase 0; bump if needed |
| `Vec<Heir>` `.claimed` mutation pattern | MED | Settle read-modify-write storage pattern in Phase 2 |
| NFC unsupported on judge device | MED | Passkey path is the guaranteed parallel; NFC is enhancement |
| PDAX key handling | MED | Keys server-side only (serverless proxy); Layer-1 rate pull as fallback |
| Demo-day network failure | LOW-MED | 5-min demo timeout; record backup video in W3 |

## Fallback
Native Stellar claimable balances with time predicates (doc §6.4) = working dead-man's-switch if Soroban fights us in W3. Safety net only.
