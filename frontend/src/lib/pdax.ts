// Client-side PDAX helper. Only ever calls our own /api/* endpoints — the
// PDAX credentials live server-side and never reach the browser.

export interface RateQuote {
  rate: number
  source: 'live' | 'fallback'
  base: string
  quote: string
  amount: number
  php: number
  ts: number
}

export interface WithdrawReceipt {
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

/** Execute a USDC→PHP cash-out to a payout channel. Hits our own endpoint;
 *  PDAX keys stay server-side. */
export async function withdrawToFiat(
  amount: number,
  method: string,
  destination: string,
): Promise<WithdrawReceipt> {
  const res = await fetch('/api/pdax-withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, method, destination }),
  })
  if (!res.ok) throw new Error(`withdraw failed (${res.status})`)
  return res.json() as Promise<WithdrawReceipt>
}

/** Indicative PHP quote for `amount` of `base` (default USDC, SELL). */
export async function getRate(
  amount: number,
  base = 'USDC',
  side: 'BUY' | 'SELL' = 'SELL',
): Promise<RateQuote> {
  const res = await fetch(
    `/api/pdax-rate?base=${base}&amount=${amount}&side=${side}`,
  )
  if (!res.ok) throw new Error(`rate lookup failed (${res.status})`)
  return res.json() as Promise<RateQuote>
}
