import { useCallback, useEffect, useState } from 'react'
import { CONFIG } from '../config'

export interface ActivityItem {
  id: string
  icon: string
  label: string
  sub?: string
  when: string
  /** 'in' credited the account, 'out' debited it, 'neutral' otherwise. */
  dir: 'in' | 'out' | 'neutral'
}

interface BalanceChange {
  type: string
  from?: string
  to?: string
  amount?: string
  asset_type?: string
  asset_code?: string
}

interface HorizonOp {
  id: string
  type: string
  created_at: string
  from?: string
  to?: string
  amount?: string
  asset_type?: string
  asset_code?: string
  starting_balance?: string
  asset_balance_changes?: BalanceChange[]
}

function relTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

const asset = (a?: { asset_type?: string; asset_code?: string }) =>
  !a || a.asset_type === 'native' ? 'XLM' : a.asset_code ?? 'asset'

/** Turns one Horizon operation into a friendly activity row, from `me`'s view. */
function mapOp(op: HorizonOp, me: string): ActivityItem | null {
  const when = relTime(op.created_at)
  switch (op.type) {
    case 'payment': {
      const incoming = op.to === me
      return {
        id: op.id,
        icon: incoming ? 'arrow_downward' : 'arrow_upward',
        label: `${incoming ? 'Received' : 'Sent'} ${Number(op.amount).toLocaleString()} ${asset(op)}`,
        when,
        dir: incoming ? 'in' : 'out',
      }
    }
    case 'create_account':
      return {
        id: op.id,
        icon: 'add_circle',
        label: `Account funded (${Number(op.starting_balance).toLocaleString()} XLM)`,
        when,
        dir: 'in',
      }
    case 'change_trust':
      return {
        id: op.id,
        icon: 'link',
        label: `Trustline updated (${asset(op)})`,
        when,
        dir: 'neutral',
      }
    case 'invoke_host_function': {
      // Soroban call — surface any token movement it caused (claim, deposit…).
      const change = (op.asset_balance_changes ?? []).find(
        (c) => c.to === me || c.from === me,
      )
      if (change) {
        const incoming = change.to === me
        return {
          id: op.id,
          icon: incoming ? 'redeem' : 'arrow_upward',
          label: `${incoming ? 'Received' : 'Sent'} ${Number(change.amount).toLocaleString()} ${asset(change)}`,
          sub: 'Vault transaction',
          when,
          dir: incoming ? 'in' : 'out',
        }
      }
      return { id: op.id, icon: 'bolt', label: 'Vault transaction', when, dir: 'neutral' }
    }
    default:
      return {
        id: op.id,
        icon: 'receipt_long',
        label: op.type.replace(/_/g, ' '),
        when,
        dir: 'neutral',
      }
  }
}

/** Recent on-chain activity for the connected account (read from Horizon). */
export function useActivity(address: string | null, limit = 8) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!address) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `${CONFIG.horizonUrl}/accounts/${address}/operations?order=desc&limit=${limit}&include_failed=false`,
      )
      if (res.status === 404) {
        setItems([])
        return
      }
      if (!res.ok) throw new Error(`Horizon ${res.status}`)
      const j = await res.json()
      const ops: HorizonOp[] = j._embedded?.records ?? []
      setItems(ops.map((op) => mapOp(op, address)).filter((x): x is ActivityItem => x !== null))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [address, limit])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { items, loading, error, refresh }
}
