/** RWA valuation oracle reads (Phase 2). The oracle contract holds signed
 *  appraiser attestations keyed by an asset's SAC address; the vault UI reads
 *  the latest one instead of a hardcoded value. See docs/RWA_PHASES.md. */
import { CONFIG } from './config'
import { readContract, addr } from './stellar'

export interface Attestation {
  /** Attested value in whole PHP. */
  valuePhp: bigint
  /** sha256 of the signed appraisal document (hex). */
  docHash: string
  /** Appraiser address that signed it. */
  appraiser: string
  /** Ledger timestamp (seconds). */
  timestamp: bigint
}

/** Raw shape scValToNative produces from the contract's `Attestation` struct. */
interface RawAttestation {
  value_php: bigint
  doc_hash: Uint8Array
  appraiser: string
  timestamp: bigint
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Latest attestation for a token's SAC, or null if none exists (the oracle
 *  traps `NoAttestation`, surfaced here as a rejected simulation → null). */
export async function getAttestation(
  sac: string,
  source: string,
): Promise<Attestation | null> {
  try {
    const raw = await readContract<RawAttestation>(
      CONFIG.oracleId,
      'get_attestation',
      [addr(sac)],
      source,
    )
    if (!raw) return null
    return {
      valuePhp: BigInt(raw.value_php),
      docHash: toHex(raw.doc_hash),
      appraiser: raw.appraiser,
      timestamp: BigInt(raw.timestamp),
    }
  } catch {
    return null
  }
}
