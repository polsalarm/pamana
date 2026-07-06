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
const BASE =
  process.env.PDAX_BASE_URL ??
  'https://uat.services.sandbox.pdax.ph/api/pdax-api'
const IN = `${BASE}/pdax-institution/v1`
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
  opts: { query?: Record<string, string | number>; body?: unknown } = {},
): Promise<T> {
  const t = await tokens()
  const qs = opts.query
    ? '?' +
      new URLSearchParams(
        Object.fromEntries(
          Object.entries(opts.query).map(([k, v]) => [k, String(v)]),
        ),
      ).toString()
    : ''
  const res = await fetch(`${IN}${path}${qs}`, {
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
  source: 'live' | 'fallback'
  base: string
  quote: string
}

/** Flat PHP payout fee per channel (UAT — mirrors the demo pricing). */
const PAYOUT_FEES: Record<string, number> = { gcash: 15, maya: 15, bank: 25 }

export interface WithdrawResult {
  /** `submitted` = PDAX accepted the payout; `simulated` = UAT declined
   *  (mock liquidity/pricing) so we returned a demo reference. */
  status: 'submitted' | 'simulated'
  reference: string
  amountUsdc: number
  rate: number
  rateSource: 'live' | 'fallback'
  php: number
  fee: number
  net: number
  method: string
}

/** Off-ramp execution (heir, USDC→PHP→cash). Per docs/PDAX_API.md:
 *  SELL USDC→PHP via /trade then POST /fiat/withdraw to the payout channel.
 *  UAT OTC is mock and often 500s, so each leg degrades to a simulated receipt
 *  rather than throwing — the caller always gets a breakdown. */
export async function withdrawFiat(params: {
  amount: number
  method: string
  destination: string
}): Promise<WithdrawResult> {
  const { amount, method, destination } = params
  const q = await getRate('USDC', 'PHP', amount, 'SELL')
  const php = +(q.rate * amount).toFixed(2)
  const fee = PAYOUT_FEES[method] ?? 15
  const net = +(php - fee).toFixed(2)
  const base = {
    amountUsdc: amount,
    rate: q.rate,
    rateSource: q.source,
    php,
    fee,
    net,
    method,
  }

  try {
    // Firm quote → execute SELL → fiat payout. Any leg failing (UAT mock)
    // drops us to the simulated branch below.
    const quote = await authed<{ id?: string; quote_id?: string }>(
      'POST',
      '/trade/quote',
      { body: { base_currency: 'USDC', quote_currency: 'PHP', base_quantity: amount, side: 'SELL' } },
    )
    const quoteId = quote.id ?? quote.quote_id
    if (quoteId) await authed('POST', '/trade', { body: { quote_id: quoteId } })

    const wd = await authed<{ id?: string; reference?: string }>(
      'POST',
      '/fiat/withdraw',
      { body: { currency: 'PHP', amount: net, channel: method, destination } },
    )
    return {
      status: 'submitted',
      reference: wd.reference ?? wd.id ?? `PDAX-${Date.now()}`,
      ...base,
    }
  } catch {
    return { status: 'simulated', reference: `SIM-${Date.now()}`, ...base }
  }
}

/** Indicative rate for base→quote. Falls back if the UAT OTC service is down. */
export async function getRate(
  base: string,
  quote: string,
  baseQuantity: number,
  side: 'BUY' | 'SELL',
): Promise<RateResult> {
  try {
    const j = await authed<Record<string, unknown>>('GET', '/trade/price', {
      query: {
        base_currency: base,
        quote_currency: quote,
        base_quantity: baseQuantity,
        side,
      },
    })
    // Parse defensively — UAT shape unconfirmed. Try common fields.
    const raw =
      (j.price as number) ??
      (j.rate as number) ??
      (j.average_price as number) ??
      (j.quote_quantity != null && baseQuantity
        ? Number(j.quote_quantity) / baseQuantity
        : undefined)
    const rate = Number(raw)
    if (Number.isFinite(rate) && rate > 0) {
      return { rate, source: 'live', base, quote }
    }
    throw new Error('no usable price field')
  } catch {
    return { rate: RATE_FALLBACK, source: 'fallback', base, quote }
  }
}
