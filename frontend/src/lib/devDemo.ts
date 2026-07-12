import { NATIVE_SAC, RWA_HOUSE_SAC } from './config'
import type { VaultStatus, Heir } from './contract'

export const DEMO_OWNER = 'GDVWTEQQHWWPB7BHGVZDNZQGNWNB4EDLOKTHHNW2AXLI7JBC6SRJM4X3'
export const DEMO_HEIR = 'GBZ6Y7PIRZ4T4KTKSF5FOOV5Y2J6PKDPYWUQK5M73T4XWBJ7W3FJMTJL'
export const DEMO_VAULT = 'CDJOXNIY6FMVUBDCDYV3VXWDXVZ323WURQ3VOLSNGH6BTHBMXP7X5LJG'
export const DEMO_USDC_SAC = 'CBIELGZLHDNXXFZAJFY75R7O2YQRKWKZC2QHTCNZUZ5CZFXNDEGCX42R'

export function demoCaptureEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  if (window.location.search.includes('demoCapture=1')) {
    localStorage.setItem('pamana.demoCapture', '1')
    return true
  }
  return localStorage.getItem('pamana.demoCapture') === '1'
}

export const demoHeirs: Heir[] = [
  { addr: DEMO_HEIR, bps: 7000 },
  { addr: 'GC4QOYDZALN55DJN5Y6RC4Y7SKLQZMG3M4G7WZQO6NDRZ5HB7X6BHF4U', bps: 3000 },
]

export const demoVaultData = {
  vaultId: DEMO_VAULT,
  status: 'Alive' as VaultStatus,
  timeout: 90n * 24n * 60n * 60n,
  heartbeat: BigInt(Math.floor(Date.now() / 1000)) - 12n * 60n,
  tokens: [
    { sac: NATIVE_SAC, balanceStroops: 500_0000000n },
    { sac: DEMO_USDC_SAC, balanceStroops: 350_0000000n },
    { sac: RWA_HOUSE_SAC, balanceStroops: 1_0000000n },
  ],
  heirs: demoHeirs,
}

export const demoClaimData = {
  vaultId: DEMO_VAULT,
  status: 'TimedOut' as VaultStatus,
  sharePct: 70,
  bps: 7000,
  tokens: [
    {
      sac: NATIVE_SAC,
      symbol: 'XLM',
      estimate: 350,
      claimed: false,
      asset: { native: true as const },
      trusted: true,
    },
    {
      sac: DEMO_USDC_SAC,
      symbol: 'USDC',
      estimate: 245,
      claimed: false,
      asset: { native: false as const, code: 'USDC', issuer: DEMO_OWNER },
      trusted: true,
    },
  ],
}

/** Demo RWA attestation (Phase 2) — mirrors the on-chain HOUSE01 attestation
 *  so demo-capture mode shows the oracle-backed valuation without an RPC call. */
export const demoAttestation = {
  valuePhp: 2_400_000n,
  docHash: 'e57ac339f57c5333a1274592de4789c89e1dd9dbfbd1bf5e99393fad94753c20',
  appraiser: 'GDOAIKHT3YRNH4ELPS4QZ6BE5ZBCPQT2CCPXS7D33RMI4HJJOAAWP2VK',
  timestamp: BigInt(Math.floor(Date.now() / 1000)) - 3600n,
}

export const demoQuote = {
  rate: 58,
  source: 'fallback' as const,
  provider: 'constant' as const,
  base: 'USDC',
  quote: 'PHP',
  amount: 350,
  php: 20300,
  ts: Date.now(),
}