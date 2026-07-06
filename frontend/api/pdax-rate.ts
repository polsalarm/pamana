/**
 * GET /api/pdax-rate?base=USDC&amount=100&side=SELL
 * Returns an indicative PHP rate for the given crypto amount. Keys stay
 * server-side; the client only ever hits this endpoint.
 */
import { getRate } from './_pdax.js'

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const base = (url.searchParams.get('base') ?? 'USDC').toUpperCase()
  const amount = Number(url.searchParams.get('amount') ?? '1')
  const side = (url.searchParams.get('side') ?? 'SELL').toUpperCase() as
    | 'BUY'
    | 'SELL'

  try {
    const r = await getRate(base, 'PHP', amount > 0 ? amount : 1, side)
    return Response.json({
      ...r,
      amount,
      php: +(r.rate * amount).toFixed(2),
      ts: Date.now(),
    })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'rate failed' },
      { status: 502 },
    )
  }
}
