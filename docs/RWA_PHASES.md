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

---

## 🚧 Demo shortcuts — read before demoing or claiming this is production

Everything on-chain here is **real on testnet**. What is **simulated** is the
*human/legal judgment* that a licensed operator would supply. Single source of
truth:

| Thing | Real? | Notes |
|-------|-------|-------|
| Tokenized title as a Stellar asset | ✅ real | issued, SAC-wrapped, in the vault |
| Issuer controls (revocable, clawback) | ✅ real | issuer can freeze / claw back |
| Inheritance of the title (deposit → timeout → heir claim) | ✅ real | uses the unchanged vault |
| Valuation on-chain (signed attestation + doc hash) | ✅ real | `pamana-oracle` |
| `AUTH_REQUIRED` compliance gate | ✅ real | unapproved heir's claim is **rejected by the network** |
| Approval server authorizing a trustline | ✅ real | signs `set_authorized` with the issuer key |
| **Who the appraiser is** | 🟡 stub | a testnet keypair, not a licensed appraiser |
| **The appraised value** | 🟡 stub | a made-up figure attested to a demo document |
| **The KYC / identity check** | ❌ **simulated** | `api/kyc` **auto-approves**; no identity is checked, and **no PII is read, stored, or sent** |
| **Compliance-officer / custodian admin review** | ❌ **not built** | the auto-approve **stands in for it** |
| Legal binding of token → property | ❌ **not built** | needs a real SPV/custodian |
| Redemption clawback (token → burned on-chain) | ✅ real | `api/redeem` — classic issuer `clawback` (CAP-35) |
| **The custodian's "title actually transferred" decision** | ❌ **simulated** | `api/redeem` **auto-approves**; no real paperwork happens |

**In one line:** the *mechanisms* are real and on-chain enforced; the *decisions*
(who is a valid appraiser, who passes KYC, who legally owns the house) are
stubbed. Testnet. Not legally binding. Not a real KYC provider.

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

## Phase 3 — Compliance gate (KYC + transfer approval) ✅ *(mechanism; approver simulated)*
**Status:** Done (2026-07-12) · **Effort:** L · **Dependency:** Phase 1
**⚠️ Still gating for production:** fractional / investment-like RWA is a
regulated **security** (PH: SEC). The *mechanism* below is built and enforced
on-chain; shipping for real still needs a licensed operator (see Demo vs real).

### Scope (as built)
- **`AUTH_REQUIRED` asset (`HOUSE02`)** — a second title carrying the compliance
  gate, so `HOUSE01` stays ungated for a side-by-side demo. Under
  `AUTH_REQUIRED` **no** account or contract can hold or receive the asset until
  the issuer authorizes its trustline.
- **Approval server** (`frontend/api/kyc.ts` + `_kyc.ts`) — the SEP-8-style
  approver. On submit it authorizes the heir's trustline on-chain by calling the
  SAC's `set_authorized(heir, true)` as the SAC admin (the issuer). The issuer
  secret lives server-side only (`RWA_GATED_ISSUER_SECRET`), never in the client.
- **Claim-page gate** — a gated title shows a `KYC` badge and a **Complete KYC**
  button instead of **Claim**, with the blocked-state explained, plus a
  *Simulate rejection* path.

### Authorization mechanics (proven on testnet)
| Holder | How the issuer authorizes it |
|--------|------------------------------|
| classic account (owner, heir) | `set-trustline-flags --set-authorize` |
| **contract** (the vault) | the SAC's `set_authorized(id, true)` — classic `set-trustline-flags` cannot target a `C…` address |

An unauthorized transfer **traps**: SAC `Error #11 — "balance is deauthorized"`.
That is the gate, and it is real.

### 🚧 Demo vs real — what is simulated
**The gate is real. The compliance *decision* is stubbed.**

| Piece | Status |
|-------|--------|
| `AUTH_REQUIRED` on-chain gate | ✅ **real** — unapproved heir's claim is rejected by the network |
| Approval server authorizing the trustline | ✅ **real** — signs + submits `set_authorized` |
| Blocked-claim UI state | ✅ real |
| **The KYC / identity check** | ❌ **SIMULATED — auto-approves** |
| Sanctions / accreditation screening | ❌ not implemented |
| Custodian / compliance-officer admin review | ❌ **not implemented — auto-approve stands in for it** |

Concretely: `api/kyc` **auto-approves on submit**. It performs **no identity
verification**, and it deliberately **reads, stores, and transmits no PII** — the
client's KYC form is cosmetic and only the heir's Stellar address is sent. This
auto-approval **stands in for a real compliance officer / custodian admin
review**. A `deny: true` flag forces the rejection path so the blocked state can
be demonstrated.

To productionize: replace the auto-approve in `api/kyc.ts` with a real SEP-12
KYC flow and a licensed compliance decision. Everything downstream of that
decision (the on-chain authorization, the gate, the claim) already works.

**Testnet only. Not a real KYC provider. Not legally binding.**

### Deliverables (as built)
- `scripts/rwa/issue-rwa-gated.sh` — reproducible gated issuance + vault deposit.
- `frontend/api/kyc.ts`, `frontend/api/_kyc.ts` — demo approver (server-side).
- `frontend/src/lib/kyc.ts` — client wrapper.
- `frontend/src/pages/heir/Claim.tsx` — KYC badge, gate, blocked state,
  simulate-rejection.
- `config.ts` — `RWA_HOUSE_GATED_SAC` + `TokenInfo.rwa.gated`.

### Exit criteria — met
Heir with an unauthorized trustline is blocked (`authorized = false`); the
approver flips it (`authorized = true`) and the claim opens. Verified on testnet:
deposit into an unauthorized vault trapped with `"balance is deauthorized"`;
`POST /api/kyc` returned `{approved:true}` and the heir's `authorized` went
`false → true`; `{deny:true}` returned `{approved:false}` and left it gated.

### Skills / refs
`standards` (SEP-8, SEP-12), `assets` (regulated asset flow).

---

## Phase 4 — Redemption / title handoff ✅ *(mechanism; custodian simulated)*
**Status:** Done (2026-07-12) · **Effort:** L → came in S once Phases 1–3 existed
**Dependency:** Phases 1–3 for the mechanism; a real SPV/custodian for production

Close the loop: token → actual asset. Same shape as Phase 3 — the *mechanism*
(burn the token on-chain) is real; the *decision* ("has the real title actually
transferred?") is stubbed, because that decision belongs to a custodian who
doesn't exist yet.

### Scope (as built)
- **Redemption:** heir presents a claimed title token → (simulated) custodian
  review → issuer **clawback** (CAP-35, classic op) burns the heir's balance.
- Custodian-operated redemption step, modeled on the SEP-6/SEP-24 anchor
  pattern (analogous to the existing PDAX cash-out leg, but for titles).
- Redemption state is read from the heir's **real on-chain balance**, not a
  client-side flag — once clawback lands, the balance is genuinely `0`.

### Deliverables (as built)
- `frontend/api/redeem.ts`, `frontend/api/_redeem.ts` — demo custodian
  (server-side). Maps a SAC to its classic asset + issuer, calls
  `Operation.clawback({ asset, from: heir, amount })` signed by the issuer,
  submitted via Horizon. `deny: true` simulates a custodian hold.
- `frontend/src/lib/redeem.ts` — client wrapper (`requestRedemption`).
- `frontend/src/lib/token.ts` — `getBalance()`, used to read the heir's real
  post-claim balance.
- `frontend/src/pages/heir/Claim.tsx` — `RedeemGate`: once a title is claimed,
  shows **Redeem for title** (or **Redeemed** once balance hits 0), plus a
  *Simulate hold* path.
- `.env.example` / `.env.local` — `RWA_ISSUER_SECRET` (HOUSE01) alongside the
  existing `RWA_GATED_ISSUER_SECRET` (HOUSE02); both are the demo custodian's
  keys, server-only.

### 🚧 Demo vs real — what is simulated
**The burn is real. The custodian decision is stubbed.**

| Piece | Status |
|-------|--------|
| Classic `clawback` on the heir's balance | ✅ **real** — proven on testnet |
| Redemption state read from live balance | ✅ real |
| **"Has the real title transferred?"** | ❌ **SIMULATED — auto-approves** |
| Off-chain paperwork / title registry update | ❌ not implemented |
| Licensed SPV/custodian holding the property | ❌ not implemented |

To productionize: an SPV/custodian legally holds the property and only
authorizes `api/redeem` to fire once its own paperwork confirms the transfer.
Everything downstream (the clawback, the burn, the UI) already works.

**Testnet only. Not a real custodian. Not legally binding.**

### Exit criteria — met
Verified directly against `redeemTitle()` on testnet: minted a throwaway
HOUSE01 balance to a scratch account, redeemed it — balance went
`1.0000000 → 0.0000000` (tx confirmed on Horizon), and a second redemption
attempt against the now-empty balance failed cleanly (`"heir holds no
redeemable balance"`) instead of submitting a bad transaction.

### Skills / refs
`standards` (SEP-6/24 patterns), `assets` (clawback/CAP-35), `agentic-payments`
/ PDAX analogy for the custodian leg, legal partner for production.

---

## Effort & dependency summary

| Phase | Scope | Effort | Legal dep | Status |
|-------|-------|--------|-----------|--------|
| 0 | Static mock | — | no | ✅ superseded |
| 1 | Issued asset in vault | S–M | no | ✅ done (testnet) |
| 2 | Attested valuation | M | no | ✅ done (testnet) |
| 3 | KYC + approval gate | L | for prod | ✅ mechanism done; **approver simulated** |
| 4 | Redemption / title | L→S | **yes (SPV)**, for prod | ✅ mechanism done; **custodian simulated** |

**What's left is not an engineering problem.** All four phases now have their
on-chain mechanism built and proven on testnet; what remains stubbed in every
one of them is a licensed human decision:

- Phase 3's KYC auto-approve needs a real SEP-12 KYC + compliance-officer
  decision.
- Phase 4's custodian auto-approve needs a real SPV/custodian who legally
  holds the property and only fires the clawback once its own paperwork
  confirms the title actually transferred.

Until those partners exist, the app is an honest, fully-functional demo of the
inheritance + redemption *mechanism* — not a production RWA platform.

## Deliberately out of scope (why the mock stays honest)
- Legal enforceability of a token = property claim (jurisdiction-specific).
- Custodial/SPV structuring and licensing.
- Oracle trust beyond attested appraiser signatures.

These are ops/legal, not Soroban problems — which is exactly why Phase 0 keeps
the card labelled as roadmap.
