# PDAX Institutional API — reference (Pamana)

Verified against UAT on 2026-07-10 by live probing. **No secrets here** — credentials live in server-side env only (`PDAX_USERNAME`, `PDAX_PASSWORD` in Vercel + gitignored `.env.local`).

Legend: ✅ = response observed live from UAT · 📄 = documented only, not yet exercised.

## Environment
- **UAT base URL:** `https://uat.services.sandbox.pdax.ph/api/pdax-api`
- **Two API versions coexist.** Pricing/quotes are on **`/pdax-institution/v2`**; auth, funding, withdrawals and balances are on **`/pdax-institution/v1`**. Mixing them up is the single easiest way to get a 400.
- UAT fiat settlement is sandboxed (PayMongo test checkout). Cash-in requests are accepted and then fail to settle — that is expected sandbox behaviour, not a bug.
- **Crypto is real testnet.** The stage environment issues testnet addresses (see [Testnet asset codes](#testnet-asset-codes)), so a crypto deposit is an actual on-chain transfer.

## Docs portal (public — not gated)
`https://doc.general.api.pdax.ph/` — open it in a browser. It is a Gatsby SPA, so `curl` sees an empty shell; the full content is plain JSON at:
```
https://doc.general.api.pdax.ph/page-data/index/page-data.json
```
No credentials required. (An earlier revision of this file claimed Basic-auth; that was wrong.)

---

## Auth ✅
```
POST /pdax-institution/v1/login
body: { "username": "<email>", "password": "<pw>" }
→ 200 { username(uuid), email, phone_number, access_token, id_token, refresh_token, token_type, preferred_mfa, expiry }
```
- No MFA on the test account (`preferred_mfa: "NOT_SET"`). `POST /otp` exists for accounts that require it. 📄
- `expiry: 600` seconds → cache the token, re-login before expiry.
- **Authenticated requests need two headers:** `access_token` and `id_token` (raw token values, not `Bearer`).
- Refresh: `PUT /pdax-institution/v1/refresh-token`. 📄

## Balances ✅
```
GET /pdax-institution/v1/balances     (headers: access_token, id_token)
→ 200 { data: [ { currency, available, hold, total, asset_type: "FIAT"|"CRYPTO" }, ... ] }
```
Test account holds **PHP · USDC · XLM**.

---

## Pricing — use v2 ✅

⚠️ **`/v1/trade/price` is dead.** It returns `{"code":"ERR_BAD_REQUEST","name":"OTCServiceError","message":"Request failed with status code 400"}` for every input. This is *not* an upstream OTC outage — v1 is simply superseded. Use v2.

```
GET /pdax-institution/v2/trade/price
```
| Param | Required | Meaning |
|-------|----------|---------|
| `side` | yes | `buy` or `sell` (lowercase) |
| `quote_currency` | yes | the **crypto** asset — e.g. `USDC`, `XLM` |
| `base_currency` | yes | the **fiat** side — `PHP` |
| `currency` | yes | which currency `quantity` is denominated in |
| `quantity` | yes | amount, in units of `currency` |

> **The naming is inverted relative to v1.** In v2 `base_currency` is PHP and `quote_currency` is the crypto. Getting this backwards yields a 400.

Verified responses:
```jsonc
// ?side=sell&quote_currency=USDC&base_currency=PHP&currency=USDC&quantity=10
{ "data": { "base_currency":"PHP", "quote_currency":"USDC", "side":"sell",
            "base_quantity":10, "price":61.577, "total_amount":615.77 }, "status":"success" }

// ?side=buy&quote_currency=USDC&base_currency=PHP&currency=PHP&quantity=1000
{ "data": { "base_quantity":16.23982, "price":61.577, "total_amount":1000 }, "status":"success" }

// ?side=sell&quote_currency=XLM&base_currency=PHP&currency=XLM&quantity=100
{ "data": { "base_quantity":100, "price":7.272, "total_amount":727.2 }, "status":"success" }
```
The rate lives at `data.price` (PHP per 1 unit of crypto), **not** at the top level.

**Minimum quantity is enforced.** Below it:
```json
{ "code":"OT010027", "name":"OTCServiceError", "message":"Order quantity is less than minimum required quantity" }
{ "code":2003, "name":"OTCServiceError", "message":"qty is below IMM minimum quantity. Must be at least 1 USDC. ..." }
```
Note PDAX prices XLM at ~₱7.27 while public spot feeds say ~₱11. For a PDAX off-ramp, **PDAX's number is the correct one to display.**

## Trading (firm quote → order) ✅
```
POST /pdax-institution/v2/trade/quote     firm executable quote
POST /pdax-institution/v1/trade           accept a quote — this EXECUTES the trade
GET  /pdax-institution/v1/orders/{order_id}   order details        📄
GET  /pdax-institution/v1/orders              order list           📄
```

**Firm quote** — same param shape as v2 price:
```jsonc
POST /v2/trade/quote
{ "side":"sell", "quote_currency":"USDC", "base_currency":"PHP", "currency":"USDC", "quantity":"3" }
→ { "data": { "quote_id":"018fa0b8-…", "expires_at":"2024-05-22T14:33:46.111Z", … }, "status":"success" }
```

**Order** — all three fields are required. Omitting `idempotency_id` gives
`{"code":400,"message":"\"idempotency_id\" is required"}`.
```jsonc
POST /v1/trade
{ "quote_id":"…", "side":"sell", "idempotency_id":"<uuid v4>" }
→ { "data": { "order_id":122121, "status":"successful", "base_quantity":3, "price":61.577, … } }
```
Verified live: selling 3 USDC moved the sandbox balance `9995 → 9992` and credited PHP.

---

## Funding

### Crypto deposit address ✅ (schema) / 📄 (live call)
```
GET /pdax-institution/v1/crypto/deposit?currency=USDCXLM
→ 200 { "data": { "currency":"USDCXLM", "address":"G...", "tag":"123123123" }, "status":"success" }
```
- `tag` is the **memo**. A Stellar deposit without the memo is unattributable and effectively lost.
- Errors: `{ "code":400, "message":"\"currency\" is required" }`, `{ "code":"FailedRetrievingWallet", "message":"Failed retrieving USDCXLM wallet." }`

### Fiat deposit (cash-in) 📄
```
POST /pdax-institution/v1/fiat/deposit
```
Body is a **full travel-rule payload**, not just an amount:
```
amount, currency:"PHP", method,
sender_first_name, sender_middle_name, sender_last_name, sender_dob,
sender_nationality, sender_national_identity_number, sender_place_of_birth,
sender_country_origin, sender_address_line_one, sender_address_line_two,
sender_city, sender_province, sender_country, sender_zip_code,
sender_phone_number, sender_email, source_of_funds,
beneficiary_first_name, beneficiary_middle_name, beneficiary_last_name,
beneficiary_sex, beneficiary_dob, beneficiary_nationality,
beneficiary_address_line_one, beneficiary_address_line_two, beneficiary_barangay,
beneficiary_city, beneficiary_province, beneficiary_country, beneficiary_zip_code,
beneficiary_government_issued_id, beneficiary_phone_number,
purpose, relationship_of_sender_to_beneficiary, nature_of_business
```
Response:
```json
{ "request_id":"a3bb3030-...", "identifier":"Zek_141", "reference_number":"eyJ0...",
  "amount":48000, "method":"instapay_upay_cashin",
  "payment_checkout_url":"https://test-sources.paymongo.com/sources?id=src_...",
  "fee":30, "status":"PENDING" }
```
`method` ∈ `instapay_upay_cashin` · `gcash_cashin` · `grabpay_cashin` · `ub_online_upay_cashin` · `pesonet` · `instapay_emi_p`

The checkout URL is **PayMongo sandbox** — it never settles, and PDAX emails a "Cash In Failed" notice. Expected.

> **PII warning.** This payload carries names, DOB, national ID and addresses. It must never be collected in the browser or persisted client-side. Keep a fixed sender/beneficiary profile in server-side env for the demo.

---

## Withdrawals

### Fiat withdraw (cash-out) ✅
```
POST /pdax-institution/v1/fiat/withdraw
```
```
identifier, currency:"PHP", amount, method,
beneficiary_first_name, beneficiary_middle_name, beneficiary_last_name,
beneficiary_bank_code, beneficiary_account_name, beneficiary_account_number,
sender_first_name, sender_middle_name, sender_last_name, sender_country_origin,
purpose, relationship_of_sender_to_beneficiary, source_of_funds
```
Response is nested under `data`:
```json
{ "data": { "identifier":"ABC123", "reference_number":"eyJ0...", "amount":1000,
            "method":"PAY-TO-ACCOUNT-NON-REAL-TIME", "retry_methods":[ ... ] } }
```
- `method` ∈ `PAY-TO-ACCOUNT-REAL-TIME` (InstaPay) · `PAY-TO-ACCOUNT-NON-REAL-TIME` (PESONet)
- `beneficiary_bank_code` comes from Accepted Values → Bank Codes: GCash `EWGXCPH`, Maya Wallet `EWPAYPH`, Maya Bank `BAMABPH`, UnionBank `BAUBPPH`. Invalid codes 400.
- Below PHP 50,000 the sender address / national id / dob fields are **optional**; at or above, at least one of them is required.
- Enum fields are **case sensitive**: `purpose` ∈ {`Family Support`, `Gift`, …}, `relationship_of_sender_to_beneficiary` ∈ {`Family`, `Myself`, …}, `source_of_funds` ∈ {`Inheritance/Insurance`, `Compensation`, …, `Others: <Free Text>`}.
- Errors: `beneficiary_account_name is required`, `beneficiary_bank_code is required`, `Bank code {{code}} is not valid`, `There is insufficient funds in your account.`, `Channel gcash_cashin is disabled`.

> ⚠️ There is **no `channel` and no `destination` field.**

> ⚠️ **Settlement is asynchronous.** A `200` from `/fiat/withdraw` means *accepted*, not *paid*. The terminal status only appears in `GET /fiat/transactions` as `COMPLETED` or `FAILED`. In UAT a payout may be accepted and then fail. PDAX also deducts its own payout fee (PHP 15 observed on an e-wallet payout) **in addition to** the amount sent.

> ⚠️ **The SELL is not rolled back if the payout fails.** `POST /trade` settles immediately, so a subsequent `/fiat/withdraw` rejection (invalid account number, disabled channel) leaves the proceeds sitting as PHP in the PDAX account. Observed live: a bad Maya account number failed the payout *after* 2 USDC had already been sold. Validate the beneficiary account before executing the order, or be prepared to retry the payout (`retry_methods` in the response).

### Crypto withdraw ("Crypto Out") 📄
```
POST /pdax-institution/v1/crypto/withdraw
{ identifier, currency:"USDCXLM", amount:"0.1", address, tag,
  beneficiary_first_name, beneficiary_last_name, beneficiary_exchange,
  send_to_self:"false", beneficiary_wallet:"false" }
```
Travel-rule data is required at ≥ PHP 50,000 equivalent (BSP).

## Transaction status ✅
```
GET /pdax-institution/v1/fiat/transactions      → { data: [ { amount, status, method, created_at, ... } ] }
GET /pdax-institution/v1/crypto/transactions    📄
```
`status` ∈ `COMPLETED` · `FAILED` · (pending states). This is the **only** way to
learn whether a payout actually settled — the withdraw call itself just accepts it.

---

## Testnet asset codes

The stage environment uses distinct symbols. **Stellar testnet is `XLM_TEST`** — native XLM only; there is no Stellar-testnet USDC code.

| Token | Stage code | | Token | Stage code |
|-------|-----------|-|-------|-----------|
| BTC | `BTC_TEST` | | SOL | `SOL_TEST` |
| ETH | `ETH_TEST6`, `ETH_TEST5` | | BNB | `BNB_TEST` |
| MATIC | `MATIC_TEST` | | DOGE | `DOGE_TEST` |
| XRP | `XRP_TEST` | | BCH | `BCH_TEST` |
| **XLM** | **`XLM_TEST`** | | USDC (AVAX) | `USDC_AVAX_FUJI` |
| ADA | `ADA_TEST` | | USDC (ERC20) | `USDC_TEST3` |
| AVAX | `AVAXTEST` | | USDC (ALGO) | `ALGO_USDC_2V6G` |
| LUNA | `LUNA_TEST` | | BUSD | `BUSD_BSC_TEST` |

Mainnet uses the plain network-suffixed symbols instead — Stellar USDC is `USDCXLM`.

---

## Error shape
`{ code, name, message }` — e.g. `{ "code":"OT010018", "name":"OTCServiceError", "message":"side is required" }`. 404s: `{ "code":404, "message":"Resouce not found" }` (sic).

## Pamana ramp flows
- **Rate (both directions)** — `GET v2/trade/price`. Implemented in `api/_pdax.ts` `getRate()` as tier 1, with a public spot feed as tier 2 and `RAMP_RATE_FALLBACK` as tier 3. Only tier 3 reports `source: "fallback"`; the `provider` field says which tier answered.
- **Off-ramp (heir, crypto→PHP)** — heir claims from the vault → send testnet XLM to the `GET /crypto/deposit?currency=XLM_TEST` address **with the memo** → `POST /trade` SELL → `POST /fiat/withdraw` to a bank/e-wallet.
- **On-ramp (owner, PHP→crypto)** — `POST /fiat/deposit` → PayMongo checkout → `POST /trade` BUY → `POST /crypto/withdraw` to the owner's Stellar account (a `G…` address; a Soroban `C…` contract cannot receive a classic payment), then the owner calls `deposit()` on the vault.

## Local development gotcha
`vercel dev` does **not** read `frontend/.env.local`. Without the env, `getRate()` throws `PDAX credentials not configured` and silently degrades to the public feed — indistinguishable from "PDAX is down". Export it first:
```bash
cd frontend && set -a && . ./.env.local && set +a && vercel dev
```
Production is unaffected; Vercel injects its own environment.
