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
import { demoCaptureEnabled, demoVaultData } from '../devDemo'

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
  const [data, setData] = useState<VaultData>(() =>
    demoCaptureEnabled() ? demoVaultData : EMPTY,
  )
  const [loading, setLoading] = useState(() => !demoCaptureEnabled())
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (demoCaptureEnabled()) {
      setData(demoVaultData)
      setLoading(false)
      setError(null)
      return
    }
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

  // Keep heartbeat/status live without a manual reload — needed so the
  // check-in-soon / timed-out push reminders (VaultPanel) actually notice a
  // deadline approaching while the tab just sits open.
  useEffect(() => {
    if (!address) return
    const id = setInterval(refresh, 8_000)
    return () => clearInterval(id)
  }, [address, refresh])

  return { ...data, loading, error, refresh }
}
