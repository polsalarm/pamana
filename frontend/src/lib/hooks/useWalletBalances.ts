import { useCallback, useEffect, useState } from 'react'
import { CONFIG } from '../config'

export interface WalletBalance {
  /** Display code — 'XLM' for native, else the classic asset code. */
  code: string
  /** Human amount (already scaled). */
  amount: number
  native: boolean
  issuer?: string
}

interface HorizonBalance {
  asset_type: string
  balance: string
  asset_code?: string
  asset_issuer?: string
}

/** Reads the connected account's real on-chain balances from Horizon — i.e.
 *  exactly what the wallet holds, including assets just claimed from a vault.
 *  An unfunded account (404) is treated as empty rather than an error. */
export function useWalletBalances(address: string | null) {
  const [balances, setBalances] = useState<WalletBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!address) {
      setBalances([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${CONFIG.horizonUrl}/accounts/${address}`)
      if (res.status === 404) {
        setBalances([])
        return
      }
      if (!res.ok) throw new Error(`Horizon ${res.status}`)
      const j = await res.json()
      const list: WalletBalance[] = (j.balances ?? [])
        .map((b: HorizonBalance) => {
          const native = b.asset_type === 'native'
          return {
            code: native ? 'XLM' : b.asset_code ?? '???',
            amount: parseFloat(b.balance),
            native,
            issuer: b.asset_issuer,
          }
        })
        // Hide liquidity-pool shares and other non-asset rows.
        .filter((b: WalletBalance) => b.code !== '???')
      setBalances(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { balances, loading, error, refresh }
}
