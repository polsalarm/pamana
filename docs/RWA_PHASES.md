# Pamana — RWA Phase Plan

Forward plan for turning the **Real-World Asset** card from a roadmap mock into
a working inheritance path. Companion to [`BUILD_PLAN.md`](BUILD_PLAN.md); as-built
results get logged in [`PHASE_LOG.md`](PHASE_LOG.md) as each phase lands.

> 🔐 **Secrets rule:** only **public** keys / addresses / contract IDs go in the
> phase log. Issuer secret keys live in `~/.config/stellar/` and env files —
> never in the repo.

---

## Where we are

- **Today:** `RwaCard` (`frontend/src/components/RoadmapCards.tsx`) is a static
  card — `₱2,400,000 · tokenized title`, labelled *"Needs a legal + oracle
  layer — kept honest as roadmap."* No contract, no token, no claim path.

## What the vault already gives us for free

The vault is **token-address-agnostic**. `deposit(token: Address, amount)` runs a
generic SEP-41 `token::Client.transfer`; there is **no allowlist**. So any RWA
modeled as an issued Stellar asset (bridged through its SAC) already inherits,
with zero contract changes:

| Capability | Vault fn | Notes |
|------------|----------|-------|
| Custody | `deposit` / `withdraw` | any SAC address |
| Inheritance | `claim(token, heir)` | per-token, per-heir |
| Staggered release | `set_schedule` → `ReleaseSlot` | vesting over time |
| Dead-man's-switch | `check_in` / `get_status` | timeout + heartbeat |
| N-of-M recovery | (guardian multisig) | already enforced |

**The plumbing is not the gap.** The gap is everything that makes a token *mean*
a real asset and stay legally + economically bound to it.

---

## Phase 0 — Roadmap mock ✅
**Status:** Done (current) · **Effort:** —

Static `RwaCard` displaying the vision. Honest placeholder. No on-chain anything.

**Exit criteria:** met — card renders, copy admits it's roadmap.

---

## Phase 1 — Demo-real: issued asset in a real vault ✅
**Status:** Done (2026-07-12) · **Effort:** S–M · **Dependency:** none (pure engineering)

The high-leverage phase. Converts the mock into a genuinely on-chain RWA
inheritance demo using the **existing** vault. No legal partner needed.

### Scope
- Issue a **testnet Stellar asset** representing one asset (`HOUSE01`),
  amount `1` (NFT-style), from a dedicated **issuer account**.
- Set issuer flags: `AUTH_REVOCABLE` + `AUTH_CLAWBACK_ENABLED` (CAP-35) — issuer
  can freeze and claw back. **`AUTH_REQUIRED` deferred to Phase 3:** with it set,
  the vault contract *and* the heir each need a pre-authorized trustline, which
  blocks deposit/claim without an approval server — that server is the Phase 3
  SEP-8 work, so per-holder approval belongs there, not here.
- Bridge the asset to Soroban via its **SAC**; deposit it into the owner's vault
  with the existing `deposit(sac, 1_unit)`.
- UI: surface the issued token as a vault asset (asset code, attested value, doc
  reference) with an RWA badge + "testnet / not legally binding" note.

### Deliverables (as built)
- `scripts/rwa/issue-rwa.sh` — creates issuer, sets flags, mints, trustline,
  SAC-wraps, deposits into the vault. Idempotent-ish, testnet.
- `frontend/src/lib/config.ts` — `TokenInfo.rwa` metadata + `RWA_HOUSE_SAC`
  registered in `KNOWN_TOKENS`.
- `frontend/src/components/VaultPanel.tsx` — RWA badge + attested value row.
- `frontend/src/lib/devDemo.ts` — RWA title added to demo fixtures.

### Exit criteria — met
Owner deposited `HOUSE01` into the vault on testnet; `get_tokens` returns the
SAC; the vault UI shows `1 HOUSE01` with the RWA badge. Heir `claim(sac, heir)`
uses the existing, unchanged claim path.

### Skills / refs
`assets` (issuance, auth flags, clawback, SAC bridge), `soroban`, `dapp`.

---

## Phase 2 — Attested valuation (oracle) ✅
**Status:** Done (2026-07-12) · **Effort:** M · **Dependency:** Phase 1

Replaced the hardcoded `₱2,400,000` with a signed, on-chain attestation.

### Scope
- **Oracle contract** (Soroban `pamana-oracle`): stores the latest
  `(value_php, doc_hash, appraiser, timestamp)` per asset, keyed by SAC address,
  written by a registered appraiser. Vault UI reads it instead of a constant.
- **Doc-hash link:** the attestation carries the sha256 of the signed appraisal
  doc, binding the on-chain figure to a specific paper
  (`docs/rwa/HOUSE01-appraisal.md`). (Kept in the attestation record itself
  rather than a separate issuer `manage_data` entry — single source of truth.)
- Trust model: single-signer per attestation with an admin-managed appraiser
  set — structured to grow into an M-of-N appraiser quorum. Attested, not a
  streamed DeFi price feed.

### Deliverables (as built)
- `contracts/pamana-oracle/` — contract + 9 unit tests (all green). Functions:
  `init`, `add_appraiser`, `remove_appraiser`, `attest`, `get_attestation`,
  `is_appraiser`, `get_admin`, `get_appraisers`.
- `frontend/src/lib/oracle.ts` — `getAttestation(sac)` read (RPC simulate).
- `frontend/src/components/VaultPanel.tsx` — `RwaMeta` row: attested value +
  freshness (`attested 1h ago`) + signing appraiser; falls back to the static
  figure if no attestation.
- `frontend/src/lib/devDemo.ts` — demo attestation. `config.ts` — `oracleId`.
- `docs/rwa/HOUSE01-appraisal.md` — the attested document.

### Exit criteria — met
Appraiser attested HOUSE01 on testnet; `get_attestation` returns
value ₱2,400,000 + matching doc hash; vault UI shows the oracle value with
recency + appraiser, not a constant.

### Skills / refs
`soroban` (oracle contract), `data` (RPC reads), `standards`.

---

## Phase 3 — Compliance gate (KYC + transfer approval)
**Status:** Not started · **Effort:** L · **Dependency:** Phase 1; legal input
**⚠️ Gating:** fractional / investment-like RWA is a regulated **security**
(PH: SEC). This phase decides whether the product can legally ship at all.

### Scope
- **SEP-12 KYC** on issue and on claim — heir must clear KYC before the
  issuer grants an authorized trustline.
- **SEP-8 approval server** — every heir claim routes through issuer approval
  before the vault release succeeds (uses `AUTH_REQUIRED` from Phase 1).
- Holding-period / accreditation gates if the asset is fractionalized.

### Exit criteria
An heir who has not cleared KYC cannot receive the RWA token; claim is blocked
at the approval server, not just hidden in the UI.

### Skills / refs
`standards` (SEP-8, SEP-12), `assets` (regulated asset flow).

---

## Phase 4 — Redemption / title handoff
**Status:** Not started · **Effort:** L · **Dependency:** Phases 1–3; custodian/SPV

Close the loop: token → actual asset.

### Scope
- **SPV / trust / custodian** legally owns the property; token = beneficial claim.
- **Redemption:** heir presents token → issuer **clawback** burns it → custodian
  executes the real title transfer off-chain.
- Custodian-operated redemption step, modeled on the SEP-6/SEP-24 anchor pattern
  (analogous to the existing PDAX cash-out leg, but for titles + KYC-gated).

### Exit criteria
A claimed RWA token can be redeemed for a documented real-world title transfer,
with the on-chain token clawed back / burned on completion.

### Skills / refs
`standards` (SEP-6/24 patterns), `agentic-payments`/PDAX analogy, legal partner.

---

## Effort & dependency summary

| Phase | Scope | Effort | Legal dep | On-chain-real? |
|-------|-------|--------|-----------|----------------|
| 0 | Static mock | — | no | no |
| 1 | Issued asset in vault | S–M | **no** | **yes (testnet)** |
| 2 | Attested valuation | M | no | yes |
| 3 | KYC + approval gate | L | yes | yes |
| 4 | Redemption / title | L | yes (SPV) | yes |

**Recommended next step: Phase 1** — the only phase that is pure engineering and
has no legal dependency. It upgrades the demo from "mock card" to "real on-chain
RWA inheritance" in ~1–2 days on the existing vault.

## Deliberately out of scope (why the mock stays honest)
- Legal enforceability of a token = property claim (jurisdiction-specific).
- Custodial/SPV structuring and licensing.
- Oracle trust beyond attested appraiser signatures.

These are ops/legal, not Soroban problems — which is exactly why Phase 0 keeps
the card labelled as roadmap.
