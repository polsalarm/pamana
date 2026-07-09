/**
 * PDAX Institutional API client (server-side only).
 *
 * Auth: POST /login (username+password) → { access_token, id_token, expiry }.
 * Authed requests send raw `access_token` + `id_token` headers. Tokens cached
 * in module scope (survives warm invocations), re-fetched before expiry.
 *
 * UAT pricing is flaky (mock OTC), so getRate() falls back to RAMP_RATE_FALLBACK.
 * Credentials come from env: PDAX_USERNAME, PDAX_PASSWORD, PDAX_BASE_URL.
 * See docs/PDAX_API.md.
 */
import { randomUUID } from 'node:crypto'

const BASE =
  process.env.PDAX_BASE_URL ??
  'https://uat.services.sandbox.pdax.ph/api/pdax-api'
const IN = `${BASE}/pdax-institution/v1`
const IN_V2 = `${BASE}/pdax-institution/v2`
const RATE_FALLBACK = Number(process.env.RAMP_RATE_FALLBACK ?? '58')

interface Tokens {
  access: string
  id: string
  exp: number // epoch ms
}
let cached: Tokens | null = null

async function login(): Promise<Tokens> {
  const username = process.env.PDAX_USERNAME
  const password = process.env.PDAX_PASSWORD
  if (!username || !password) throw new Error('PDAX credentials not configured')

  const res = await fetch(`${IN}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(`PDAX login failed: ${res.status}`)
  const j = (await res.json()) as {
    access_token: string
    id_token: string
    expiry?: number
  }
  const ttl = (j.expiry ?? 600) * 1000
  return { access: j.access_token, id: j.id_token, exp: Date.now() + ttl - 30_000 }
}

async function tokens(): Promise<Tokens> {
  if (cached && Date.now() < cached.exp) return cached
  cached = await login()
  return cached
}

async function authed<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  opts: {
    query?: Record<string, string | number>
    body?: unknown
    /** API version. Pricing/quotes live on v2; funding + auth on v1. */
    v?: 1 | 2
  } = {},
): Promise<T> {
  const t = await tokens()
  const root = opts.v === 2 ? IN_V2 : IN
  const qs = opts.query
    ? '?' +
      new URLSearchParams(
        Object.fromEntries(
          Object.entries(opts.query).map(([k, v]) => [k, String(v)]),
        ),
      ).toString()
    : ''
  const res = await fetch(`${root}${path}${qs}`, {
    method,
    headers: {
      access_token: t.access,
      id_token: t.id,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`PDAX ${method} ${path} ${res.status}: ${text}`)
  return (text ? JSON.parse(text) : undefined) as T
}

export interface Balance {
  currency: string
  available: string
  hold: string
  total: string
  asset_type: 'FIAT' | 'CRYPTO'
}

export async function getBalances(): Promise<Balance[]> {
  const j = await authed<{ data: Balance[] }>('GET', '/balances')
  return j.data ?? []
}

export interface RateResult {
  rate: number
  /** `live` = a real market rate was fetched; `fallback` = hardcoded constant. */
  source: 'live' | 'fallback'
  /** Which tier produced the rate. Surfaced so a live rate is never mistaken
   *  for a PDAX rate when it actually came from the public feed. */
  provider: 'pdax' | 'public' | 'constant'
  base: string
  quote: string
}

/** Public spot-rate feed (Layer 1 per BUILD_PLAN decision #4) — no credentials,
 *  works when PDAX UAT's mock OTC does not. Keyed by our currency codes. */
const COINGECKO_IDS: Record<string, string> = {
  USDC: 'usd-coin',
  XLM: 'stellar',
}

let publicRateCache: { key: string; rate: number; exp: number } | null = null

/** Spot `quote` per 1 `base` from the public feed. Cached 60s; null on failure. */
async function fetchPublicRate(base: string, quote: string): Promise<number | null> {
  const id = COINGECKO_IDS[base.toUpperCase()]
  if (!id) return null
  const vs = quote.toLowerCase()
  const key = `${id}:${vs}`
  if (publicRateCache?.key === key && Date.now() < publicRateCache.exp) {
    return publicRateCache.rate
  }

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 4000)
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=${vs}`,
      { signal: ctl.signal },
    )
    if (!res.ok) return null
    const j = (await res.json()) as Record<string, Record<string, number>>
    const rate = Number(j?.[id]?.[vs])
    if (!Number.isFinite(rate) || rate <= 0) return null
    publicRateCache = { key, rate, exp: Date.now() + 60_000 }
    return rate
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Flat PHP payout fee per channel (UAT — mirrors the demo pricing). */
const PAYOUT_FEES: Record<string, number> = { gcash: 15, maya: 15, bank: 25 }

/** PDAX bank codes per payout channel (docs → Accepted Values → Bank Codes). */
const BANK_CODES: Record<string, string> = {
  gcash: 'EWGXCPH',
  maya: 'EWPAYPH',
  bank: process.env.PDAX_BANK_CODE ?? 'BAUBPPH', // UnionBank
}

/** Above this PHP amount BSP travel-rule requires sender address / national id
 *  / DOB. We don't collect those, so we refuse rather than send a bad request. */
const TRAVEL_RULE_THRESHOLD_PHP = 50_000

/** Sender identity for the institutional account. Server-side env only — this
 *  is the *account holder*, not the heir, and must never come from the client. */
function senderProfile() {
  return {
    sender_first_name: process.env.PDAX_SENDER_FIRST_NAME ?? 'Pamana',
    sender_middle_name: process.env.PDAX_SENDER_MIDDLE_NAME ?? 'n.a.',
    sender_last_name: process.env.PDAX_SENDER_LAST_NAME ?? 'Vault',
    sender_country_origin: process.env.PDAX_SENDER_COUNTRY ?? 'Philippines',
  }
}

/** "Juan Dela Cruz" → { first: "Juan", last: "Dela Cruz" }. PDAX wants the
 *  beneficiary's legal names split, but the payout form only asks for the
 *  account name, so derive them. */
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: 'n.a.', last: 'n.a.' }
  if (parts.length === 1) return { first: parts[0], last: 'n.a.' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

export interface WithdrawResult {
  /** `submitted` = PDAX accepted the payout; `simulated` = a leg failed
   *  (sandbox settlement, disabled channel, insufficient funds) and we returned
   *  a demo reference. `failure` says which leg and why. */
  status: 'submitted' | 'simulated'
  reference: string
  amountUsdc: number
  rate: number
  rateSource: 'live' | 'fallback'
  rateProvider: 'pdax' | 'public' | 'constant'
  php: number
  fee: number
  net: number
  method: string
  failure?: { leg: 'quote' | 'order' | 'withdraw'; message: string }
}

/** Off-ramp execution (heir, USDC→PHP→cash), per docs/PDAX_API.md:
 *
 *    POST v2/trade/quote  (firm quote)  → quote_id
 *    POST v1/trade        (accept quote, executes the SELL)
 *    POST v1/fiat/withdraw (payout to the heir's e-wallet / bank account)
 *
 *  Any leg can fail in the sandbox (settlement is mocked, channels get
 *  disabled, the account can run dry). Rather than throwing we return a
 *  `simulated` receipt that names the leg that failed, so the caller can be
 *  honest about what did and did not reach PDAX. */
export async function withdrawFiat(params: {
  amount: number
  method: string
  destination: string
  accountName: string
}): Promise<WithdrawResult> {
  const { amount, method, destination, accountName } = params
  const q = await getRate('USDC', 'PHP', amount, 'SELL')
  const php = +(q.rate * amount).toFixed(2)
  const fee = PAYOUT_FEES[method] ?? 15
  const net = +(php - fee).toFixed(2)
  const base = {
    amountUsdc: amount,
    rate: q.rate,
    rateSource: q.source,
    rateProvider: q.provider,
    php,
    fee,
    net,
    method,
  }

  let leg: 'quote' | 'order' | 'withdraw' = 'quote'
  try {
    if (net >= TRAVEL_RULE_THRESHOLD_PHP) {
      throw new Error(
        `payouts of PHP ${TRAVEL_RULE_THRESHOLD_PHP}+ require BSP travel-rule data (sender address / national id / dob) which this app does not collect`,
      )
    }
    const bankCode = BANK_CODES[method]
    if (!bankCode) throw new Error(`unknown payout method "${method}"`)

    // 1. Firm quote (v2 — quote_currency is the crypto, base_currency is PHP).
    const quote = await authed<{ data?: { quote_id?: string } }>(
      'POST',
      '/trade/quote',
      {
        v: 2,
        body: {
          side: 'sell',
          quote_currency: 'USDC',
          base_currency: 'PHP',
          currency: 'USDC',
          quantity: String(amount),
        },
      },
    )
    const quoteId = quote?.data?.quote_id
    if (!quoteId) throw new Error('firm quote returned no quote_id')

    // 2. Accept the quote — this executes the SELL. `idempotency_id` is
    //    required and must be a uuid v4; it makes the order safe to retry.
    leg = 'order'
    await authed('POST', '/trade', {
      body: { quote_id: quoteId, side: 'sell', idempotency_id: randomUUID() },
    })

    // 3. Fiat payout. Field names are exact; there is no `channel`/`destination`.
    //    NOTE: the SELL above has already settled by now. If this leg fails
    //    (bad account number, disabled channel) the pesos stay in the PDAX
    //    account rather than rolling back — `failure.leg` will say `withdraw`.
    leg = 'withdraw'
    const beneficiary = splitName(accountName)
    const wd = await authed<{
      data?: { identifier?: string; reference_number?: string }
    }>(
      'POST',
      '/fiat/withdraw',
      {
        body: {
          identifier: randomUUID(),
          currency: 'PHP',
          amount: String(net),
          method: 'PAY-TO-ACCOUNT-REAL-TIME',
          ...senderProfile(),
          beneficiary_first_name: beneficiary.first,
          beneficiary_middle_name: 'n.a.',
          beneficiary_last_name: beneficiary.last,
          beneficiary_bank_code: bankCode,
          beneficiary_account_name: accountName,
          beneficiary_account_number: destination,
          purpose: 'Family Support',
          relationship_of_sender_to_beneficiary: 'Family',
          source_of_funds: 'Inheritance/Insurance',
        },
      },
    )
    return {
      status: 'submitted',
      reference:
        wd?.data?.reference_number ?? wd?.data?.identifier ?? `PDAX-${Date.now()}`,
      ...base,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[pdax withdrawFiat ${leg}]`, message)
    return {
      status: 'simulated',
      reference: `SIM-${Date.now()}`,
      failure: { leg, message },
      ...base,
    }
  }
}

/** Indicative rate for base→quote, in three tiers:
 *  1. PDAX `/trade/price` — the real venue rate. UAT's mock OTC currently 400s.
 *  2. Public spot feed — no credentials, always available.
 *  3. `RAMP_RATE_FALLBACK` — last resort so the UI never blocks.
 *  Only tier 3 reports `source: 'fallback'`. */
export async function getRate(
  base: string,
  quote: string,
  baseQuantity: number,
  side: 'BUY' | 'SELL',
): Promise<RateResult> {
  try {
    // v2 `/trade/price`: `quote_currency` is the CRYPTO and `base_currency` is
    // PHP — the reverse of the v1 naming. `quantity` is denominated in
    // `currency`, and the venue enforces a minimum (e.g. >= 1 USDC).
    const j = await authed<{ data?: { price?: number } }>('GET', '/trade/price', {
      v: 2,
      query: {
        side: side.toLowerCase(),
        quote_currency: base,
        base_currency: quote,
        currency: base,
        quantity: baseQuantity,
      },
    })
    const rate = Number(j?.data?.price)
    if (Number.isFinite(rate) && rate > 0) {
      return { rate, source: 'live', provider: 'pdax', base, quote }
    }
    throw new Error('no usable price field')
  } catch (e) {
    // PDAX unavailable (or below minimum quantity) — try the public feed.
    console.error('[pdax getRate tier1]', e instanceof Error ? e.message : e)
  }

  const spot = await fetchPublicRate(base, quote)
  if (spot != null) {
    return { rate: spot, source: 'live', provider: 'public', base, quote }
  }

  return { rate: RATE_FALLBACK, source: 'fallback', provider: 'constant', base, quote }
}
