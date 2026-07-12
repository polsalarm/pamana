/**
 * RWA redemption — server-side (Phase 4). Demo-scoped.
 *
 * ┌─ DEMO vs REAL — READ THIS ────────────────────────────────────────────────┐
 * │ The BURN is real: this calls the classic CAP-35 `clawback` operation as    │
 * │ the asset issuer, pulling the title token out of the heir's account for    │
 * │ good. That is the on-chain half of "redeem token for the real title."      │
 * │                                                                            │
 * │ What is STUBBED is the CUSTODIAN DECISION and the off-chain title          │
 * │ transfer itself. A real deployment needs an SPV/custodian that legally     │
 * │ owns the property and only claws back once its own paperwork confirms the  │
 * │ transfer is complete. This demo AUTO-APPROVES (the caller can force a      │
 * │ denial to show the blocked path) and executes zero real-world paperwork.   │
 * │ Testnet only — not legally binding, no real custodian.                     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Redeeming = the issuer (standing in for the custodian) calling the classic
 * `clawback` operation against the heir's trustline balance. The issuer secret
 * lives in env and never reaches the client — same trust boundary as `_kyc.ts`.
 */
import {
  Horizon,
  TransactionBuilder,
  BASE_FEE,
  Asset,
  Operation,
  Keypair,
} from '@stellar/stellar-sdk'

const HORIZON_URL =
  process.env.VITE_HORIZON_URL ?? 'https://horizon-testnet.stellar.org'
const PASSPHRASE =
  process.env.VITE_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015'

interface TitleAsset {
  code: string
  issuerPk: string
  secretEnv: string
}

// Public ids — safe to default. Secrets come from env only.
const TITLES: Record<string, TitleAsset> = {
  // HOUSE01 — ungated (Phase 1)
  CAXFGZMPWQMZBCIV6KO5K4YBYKZQN57BWD62Q2WTHHNVZ4UO7I6OQJWT: {
    code: 'HOUSE01',
    issuerPk:
      process.env.RWA_ISSUER_PK ??
      'GA6NUCC4BBPBAMZADHGQOQHA3TDP3KHRG43TIW2F7VDA4VL5AZU6ECIN',
    secretEnv: 'RWA_ISSUER_SECRET',
  },
  // HOUSE02 — KYC-gated (Phase 3)
  CDPJ2C55GRIZDS67FG7D3SPZT7ND6STKLPDNCD2HQU6EUZRG3WA36UJT: {
    code: 'HOUSE02',
    issuerPk:
      process.env.RWA_GATED_ISSUER_PK ??
      'GC2PZU3LDPYHMTA4XVHMHAROU7GK4IW4NNPBTIPZ6GGYGKDSXHEB4ABB',
    secretEnv: 'RWA_GATED_ISSUER_SECRET',
  },
}

export interface RedeemResult {
  ok: boolean
  hash?: string
  error?: string
}

/** Claw back `heir`'s full balance of the title asset behind `sac`, standing
 *  in for "the custodian confirmed the real title transfer, so the token is
 *  retired." Amount is the whole 1.0 unit — these titles are NFT-style. */
export async function redeemTitle(heir: string, sac: string): Promise<RedeemResult> {
  const title = TITLES[sac]
  if (!title) return { ok: false, error: 'not a redeemable RWA title' }

  const secret = process.env[title.secretEnv]
  if (!secret) {
    return { ok: false, error: `custodian not configured (${title.secretEnv})` }
  }

  const server = new Horizon.Server(HORIZON_URL, {
    allowHttp: HORIZON_URL.startsWith('http://'),
  })
  const issuer = Keypair.fromSecret(secret)
  const asset = new Asset(title.code, title.issuerPk)

  const heirAccount = await server.loadAccount(heir)
  const heirBalance = heirAccount.balances.find(
    (b) =>
      'asset_code' in b && b.asset_code === title.code && b.asset_issuer === title.issuerPk,
  )
  const amount = heirBalance && 'balance' in heirBalance ? heirBalance.balance : null
  if (!amount || Number(amount) <= 0) {
    return { ok: false, error: 'heir holds no redeemable balance' }
  }

  const issuerAccount = await server.loadAccount(issuer.publicKey())
  const tx = new TransactionBuilder(issuerAccount, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(Operation.clawback({ asset, from: heir, amount }))
    .setTimeout(60)
    .build()
  tx.sign(issuer)

  try {
    const res = await server.submitTransaction(tx)
    return { ok: true, hash: res.hash }
  } catch (e) {
    const detail =
      e && typeof e === 'object' && 'response' in e
        ? JSON.stringify((e as { response?: { data?: unknown } }).response?.data)
        : e instanceof Error
          ? e.message
          : String(e)
    return { ok: false, error: `clawback failed: ${detail}` }
  }
}
