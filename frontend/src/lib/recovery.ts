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
