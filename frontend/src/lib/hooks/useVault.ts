import { useState, useEffect, useCallback } from 'react'
import {
  getVault,
  getStatus,
  getTimeout,
  getHeartbeat,
  getTokens,
  getHeirs,
  getVaultBalance,
  type VaultStatus,
  type Heir,
} from '../contract'

export interface TokenBalance {
  sac: string
  balanceStroops: bigint
}

export interface VaultData {
  vaultId: string | null
  status: VaultStatus | null
  timeout: bigint
  heartbeat: bigint
  tokens: TokenBalance[]
  heirs: Heir[]
}

const EMPTY: VaultData = {
  vaultId: null,
  status: null,
  timeout: 0n,
  heartbeat: 0n,
  tokens: [],
  heirs: [],
}

/** Loads an owner's vault + its live on-chain state (multi-token). */
export function useVault(address: string | null) {
  const [data, setData] = useState<VaultData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      const vaultId = await getVault(address)
      if (!vaultId) {
        setData({ ...EMPTY, vaultId: null })
        return
      }
      const [status, timeout, heartbeat, tokenList, heirs] = await Promise.all([
        getStatus(vaultId, address),
        getTimeout(vaultId, address),
        getHeartbeat(vaultId, address),
        getTokens(vaultId, address),
        getHeirs(vaultId, address),
      ])
      const tokens: TokenBalance[] = await Promise.all(
        (tokenList ?? []).map(async (sac) => ({
          sac,
          balanceStroops: await getVaultBalance(sac, vaultId, address),
        })),
      )
      setData({ vaultId, status, timeout, heartbeat, tokens, heirs })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { ...data, loading, error, refresh }
}
