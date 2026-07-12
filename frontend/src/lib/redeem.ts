/** RWA redemption (Phase 4) client wrapper.
 *
 *  DEMO: this closes the loop — claimed title token → custodian review →
 *  clawback burn, standing in for "the real title changed hands." The server
 *  (`api/redeem`) auto-approves (or, with `deny`, simulates a hold) and claws
 *  the token back on-chain via the issuer. A real deployment swaps the server
 *  for a licensed SPV/custodian that only claws back once its own paperwork
 *  confirms the transfer. Not legally binding; testnet. See docs/RWA_PHASES.md. */

export interface RedeemResult {
  approved: boolean
  hash?: string
  reason?: string
  error?: string
}

/** Submit the (demo) redemption for `heir`'s balance of `sac`. `deny` forces
 *  the simulated hold path so the blocked state can be shown. */
export async function requestRedemption(
  heir: string,
  sac: string,
  deny = false,
): Promise<RedeemResult> {
  const res = await fetch('/api/redeem?action=submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ heir, sac, deny }),
  })
  return (await res.json()) as RedeemResult
}
