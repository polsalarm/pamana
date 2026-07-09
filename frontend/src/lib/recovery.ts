import { Operation } from '@stellar/stellar-sdk'
import { CONFIG } from './config'
import { submitClassic } from './stellar'

// Native Stellar social recovery (doc §4.3). Guardians are extra signers on the
// owner's account; with a raised threshold they can co-sign a key rotation if
// the owner loses their device. This is protocol-level multisig — no MPC, no
// company backend.

export interface Signer {
  key: string
  weight: number
}
export interface Thresholds {
  low: number
  med: number
  high: number
}

/** Read the owner account's current signers + thresholds from Horizon. */
export async function getAccountSecurity(
  owner: string,
): Promise<{ signers: Signer[]; thresholds: Thresholds; masterWeight: number }> {
  const res = await fetch(`${CONFIG.horizonUrl}/accounts/${owner}`)
  if (!res.ok) throw new Error(`Account not found (${res.status})`)
  const j = await res.json()
  const signers: Signer[] = (j.signers ?? []).map(
    (s: { key: string; weight: number }) => ({ key: s.key, weight: s.weight }),
  )
  const master = signers.find((s) => s.key === owner)
  return {
    signers,
    thresholds: {
      low: j.thresholds?.low_threshold ?? 0,
      med: j.thresholds?.med_threshold ?? 0,
      high: j.thresholds?.high_threshold ?? 0,
    },
    masterWeight: master?.weight ?? 1,
  }
}

/** Add a guardian signer (default weight 1) to the owner account. */
export async function addGuardian(owner: string, guardian: string, weight = 1) {
  return submitClassic(
    [
      Operation.setOptions({
        signer: { ed25519PublicKey: guardian, weight },
      }),
    ],
    owner,
  )
}

/** Remove a guardian (weight 0 drops the signer). */
export async function removeGuardian(owner: string, guardian: string) {
  return submitClassic(
    [Operation.setOptions({ signer: { ed25519PublicKey: guardian, weight: 0 } })],
    owner,
  )
}

/** Set operation thresholds — e.g. require 2-of-3 for high-security ops. */
export async function setThresholds(owner: string, t: Thresholds) {
  return submitClassic(
    [
      Operation.setOptions({
        lowThreshold: t.low,
        medThreshold: t.med,
        highThreshold: t.high,
      }),
    ],
    owner,
  )
}

/** Smallest safe threshold for `guardianCount` guardians of weight 1.
 *
 *  Must be >= 2, otherwise a single guardian can sign alone. Recovery without
 *  the owner needs `guardianCount >= threshold`, so one guardian can never be
 *  both safe and useful — the UI asks for a second. */
export function recommendedThreshold(guardianCount: number): number {
  return Math.max(2, Math.ceil(guardianCount / 2))
}

/** Can the guardians recover the account on their own at this threshold? */
export function guardiansCanRecover(guardianCount: number, threshold: number) {
  return guardianCount >= threshold
}

/** Is the account in the dangerous default state — guardians exist but every
 *  threshold is 0, so any one of them can unilaterally sign anything? */
export function isThresholdUnsafe(guardianCount: number, t: Thresholds) {
  return guardianCount > 0 && (t.low < 2 || t.med < 2 || t.high < 2)
}

/** Enforce N-of-M multisig on the owner's account.
 *
 *  Stellar authorizes an operation when the summed weight of its signatures
 *  meets the category threshold. Guardians carry weight 1, so:
 *
 *    - `threshold` must be >= 2, or one guardian alone satisfies it.
 *    - the owner's master key gets weight == `threshold`, so the owner can
 *      still act alone (an inheritance vault owner must not need a co-signer
 *      to check in).
 *    - `threshold` guardians together can recover the account without the owner.
 *
 *  Applied as a single `setOptions` so weights and thresholds can never drift
 *  apart across two transactions — a partial apply could lock the owner out.
 *
 *  ⚠ Raising `highThreshold` above the owner's own weight would make future
 *  `setOptions` (including undoing this) impossible without guardians. We never
 *  do that: master weight always equals the threshold. */
export async function setRecoveryPolicy(owner: string, threshold: number) {
  if (threshold < 2) {
    throw new Error(
      'threshold must be at least 2 — with 1, a single guardian could sign alone',
    )
  }
  return submitClassic(
    [
      Operation.setOptions({
        masterWeight: threshold,
        lowThreshold: threshold,
        medThreshold: threshold,
        highThreshold: threshold,
      }),
    ],
    owner,
  )
}
