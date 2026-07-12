import { Asset, Operation } from '@stellar/stellar-sdk'
import { readContract } from './stellar'
import { submitClassic } from './stellar'
import { CONFIG, NATIVE_SAC } from './config'

/** The classic asset a SAC wraps, or native XLM. */
export type SacAsset = { native: true } | { native: false; code: string; issuer: string }

/** Read a token contract's symbol + decimals, and the classic asset it wraps
 *  (via the SAC `name()` = "CODE:ISSUER" or "native"). */
export async function readTokenMeta(
  sac: string,
  source: string,
): Promise<{ symbol: string; decimals: number; asset: SacAsset }> {
  const [symbol, decimals, name] = await Promise.all([
    readContract<string>(sac, 'symbol', [], source),
    readContract<number>(sac, 'decimals', [], source),
    readContract<string>(sac, 'name', [], source),
  ])
  let asset: SacAsset
  if (sac === NATIVE_SAC || name === 'native' || !name.includes(':')) {
    asset = { native: true }
  } else {
    const [code, issuer] = name.split(':')
    asset = { native: false, code, issuer }
  }
  // The native SAC reports its symbol as "native"; show it as XLM everywhere.
  const display = asset.native ? 'XLM' : symbol
  return { symbol: display, decimals: Number(decimals), asset }
}

/** Does `account` already trust this classic asset? Native never needs one. */
export async function hasTrustline(
  account: string,
  asset: SacAsset,
): Promise<boolean> {
  if (asset.native) return true
  const res = await fetch(`${CONFIG.horizonUrl}/accounts/${account}`)
  if (!res.ok) return false
  const j = await res.json()
  return (j.balances ?? []).some(
    (b: { asset_code?: string; asset_issuer?: string }) =>
      b.asset_code === asset.code && b.asset_issuer === asset.issuer,
  )
}

/** Current balance of `asset` in `account` (0 if untrusted/clawed back). Used
 *  to detect a completed redemption without any client-side state — once the
 *  issuer claws the token back, this genuinely reads 0. */
export async function getBalance(account: string, asset: SacAsset): Promise<number> {
  const res = await fetch(`${CONFIG.horizonUrl}/accounts/${account}`)
  if (!res.ok) return 0
  const j = await res.json()
  const balances: Array<{
    asset_type: string
    asset_code?: string
    asset_issuer?: string
    balance: string
  }> = j.balances ?? []
  const match = asset.native
    ? balances.find((b) => b.asset_type === 'native')
    : balances.find((b) => b.asset_code === asset.code && b.asset_issuer === asset.issuer)
  return match ? Number(match.balance) : 0
}

/** Add a trustline for a classic asset so the account can receive it. */
export async function addTrustline(account: string, asset: SacAsset) {
  if (asset.native) return
  await submitClassic(
    [Operation.changeTrust({ asset: new Asset(asset.code, asset.issuer) })],
    account,
  )
}

/** Send a classic payment from `from` to an exchange's custody address.
 *
 *  `memoId` is the exchange's destination tag and is **mandatory** — a deposit
 *  without it cannot be attributed to the account and is effectively lost. The
 *  caller must have obtained both the address and the tag from the exchange. */
export async function sendToExchange(
  from: string,
  destination: string,
  amount: number,
  memoId: string,
  asset: SacAsset = { native: true },
) {
  if (!memoId) throw new Error('exchange deposits require a memo')
  const stellarAsset = asset.native
    ? Asset.native()
    : new Asset(asset.code, asset.issuer)
  await submitClassic(
    [
      Operation.payment({
        destination,
        asset: stellarAsset,
        amount: amount.toFixed(7),
      }),
    ],
    from,
    memoId,
  )
}
