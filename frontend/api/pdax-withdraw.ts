/**
 * POST /api/pdax-withdraw  body: { amount, method, destination }
 * Executes a USDC→PHP off-ramp payout via PDAX. Keys stay server-side; the
 * client only ever hits this endpoint. See docs/PDAX_API.md.
 *
 * Vercel Node runtime signature: (req, res).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withdrawFiat } from './_pdax.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {}
  const amount = Number(body.amount)
  const method = String(body.method ?? 'gcash').toLowerCase()
  const destination = String(body.destination ?? '').trim()

  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'amount must be a positive number' })
    return
  }
  if (!destination) {
    res.status(400).json({ error: 'destination is required' })
    return
  }

  try {
    const receipt = await withdrawFiat({ amount, method, destination })
    res.status(200).json(receipt)
  } catch (e) {
    res
      .status(502)
      .json({ error: e instanceof Error ? e.message : 'withdraw failed' })
  }
}
