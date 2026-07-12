/**
 * POST /api/redeem?action=submit
 * body: { heir: string, sac: string, deny?: boolean }
 *
 * DEMO custodian for RWA redemption (Phase 4). See `_redeem.ts` for the
 * demo-vs-real boundary: the on-chain clawback/burn is real, the CUSTODIAN
 * DECISION (has the real title actually transferred?) is stubbed
 * (auto-approve). No off-chain paperwork happens here. Pass `deny: true` to
 * simulate a custodian holding the redemption back.
 *
 * Vercel Node runtime signature: (req, res).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { redeemTitle } from './_redeem.js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }
  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {}
  const heir = String(body.heir ?? '')
  const sac = String(body.sac ?? '')
  if (!heir || !sac) {
    res.status(400).json({ error: 'heir and sac are required' })
    return
  }

  // Simulated rejection — demonstrates the custodian withholding redemption.
  if (body.deny) {
    res.status(200).json({
      approved: false,
      reason: 'Redemption declined (simulated) — custodian has not confirmed the title transfer.',
    })
    return
  }

  // Auto-approve (demo) → claw back the token, standing in for a confirmed
  // off-chain title transfer.
  try {
    const result = await redeemTitle(heir, sac)
    if (!result.ok) {
      res.status(502).json({ approved: false, error: result.error })
      return
    }
    res.status(200).json({ approved: true, hash: result.hash })
  } catch (e) {
    res.status(500).json({
      approved: false,
      error: e instanceof Error ? e.message : 'redemption failed',
    })
  }
}
