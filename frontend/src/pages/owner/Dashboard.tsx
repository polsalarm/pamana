import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Layout } from '../../components/Layout'
import { Icon } from '../../components/Icon'
import { StatusLight, statusText } from '../../components/StatusLight'
import { useWallet } from '../../contexts/WalletContext'
import { useVault } from '../../lib/hooks/useVault'
import { checkIn } from '../../lib/contract'
import { shortAddr, tokenBySac } from '../../lib/config'

function daysLeft(heartbeat: bigint, timeout: bigint): number {
  const now = Math.floor(Date.now() / 1000)
  const remaining = Number(heartbeat + timeout) - now
  return Math.max(0, Math.ceil(remaining / 86400))
}

export function Dashboard() {
  const { address } = useWallet()
  const vault = useVault(address)
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)

  async function onCheckIn() {
    if (!vault.vaultId || !address) return
    setChecking(true)
    try {
      await checkIn(vault.vaultId, address)
      await vault.refresh()
    } catch (e) {
      alert(`Check-in failed: ${e instanceof Error ? e.message : e}`)
    } finally {
      setChecking(false)
    }
  }

  if (vault.loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-on-surface-variant">
          <Icon name="progress_activity" className="animate-spin text-3xl" />
          <p>Loading your vault…</p>
        </div>
      </Layout>
    )
  }

  // No vault yet → onboarding CTA.
  if (!vault.vaultId) {
    return (
      <Layout>
        <div className="flex flex-col items-center text-center py-16 gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center">
            <Icon name="add_home" className="text-3xl" />
          </div>
          <h2 className="text-2xl font-semibold">No vault yet</h2>
          <p className="text-on-surface-variant max-w-xs">
            Create your personal inheritance vault to start protecting your
            family.
          </p>
          <button
            onClick={() => navigate('/create')}
            className="bg-primary-container text-on-primary h-14 px-8 rounded-full font-semibold uppercase tracking-wider hover:opacity-90 active:scale-95 transition card-shadow"
          >
            Create My Vault
          </button>
          <button
            onClick={() => navigate('/claim')}
            className="text-primary-container font-semibold text-sm mt-2 flex items-center gap-1"
          >
            Claiming an inheritance?
            <Icon name="arrow_forward" className="text-base" />
          </button>
        </div>
      </Layout>
    )
  }

  const days = daysLeft(vault.heartbeat, vault.timeout)
  const alive = vault.status === 'Alive'

  return (
    <Layout>
      {/* Heartbeat status card */}
      <section className="bg-surface-container-lowest rounded-2xl p-6 card-shadow flex flex-col items-center text-center border border-outline-variant/30">
        <StatusLight status={vault.status} label={alive ? String(days) : undefined} />
        <h2 className="text-2xl font-semibold mt-3">{statusText(vault.status)}</h2>
        <p className="text-on-surface-variant mb-5">
          {alive ? `Next check-in in ${days} day${days === 1 ? '' : 's'}` : 'Heirs may now claim'}
        </p>
        <button
          onClick={onCheckIn}
          disabled={checking}
          className="w-full h-14 rounded-lg bg-primary-container text-on-primary font-semibold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition disabled:opacity-60"
        >
          <Icon name="favorite" />
          {checking ? 'Confirming…' : "I'm Alive"}
        </button>
      </section>

      {/* Balances (per token) + quick actions */}
      <section className="bg-surface-container-lowest rounded-2xl p-6 card-shadow border border-outline-variant/30">
        <div className="flex justify-between items-center">
          <span className="text-xs uppercase tracking-wider text-on-surface-variant">
            Pamana Vault
          </span>
          <span className="text-xs text-on-surface-variant">{shortAddr(vault.vaultId, 6)}</span>
        </div>
        <div className="mt-3 mb-5 flex flex-col gap-2">
          {vault.tokens.length === 0 ? (
            <div className="text-2xl font-bold text-on-surface-variant">0 tokens</div>
          ) : (
            vault.tokens.map((t) => {
              const info = tokenBySac(t.sac)
              const amt = Number(t.balanceStroops) / 10 ** info.decimals
              return (
                <div key={t.sac} className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold">{amt.toLocaleString()}</span>
                  <span className="text-on-surface-variant font-medium">{info.symbol}</span>
                </div>
              )
            })
          )}
        </div>
        <div className="grid grid-cols-4 gap-3">
          <QuickAction icon="arrow_downward" label="Deposit" onClick={() => navigate('/deposit')} />
          <QuickAction icon="person_add" label="Heirs" tone="amber" onClick={() => navigate('/heirs')} />
          <QuickAction icon="payments" label="Cash out" onClick={() => navigate('/offramp')} />
          <QuickAction icon="arrow_upward" label="Withdraw" tone="muted" onClick={() => navigate('/withdraw')} />
        </div>
      </section>

      {/* Heirs summary */}
      <section className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-lg font-semibold">Heirs ({vault.heirs.length})</h3>
          <button
            onClick={() => navigate('/heirs')}
            className="text-primary-container text-sm font-semibold flex items-center gap-1"
          >
            Manage <Icon name="arrow_forward" className="text-base" />
          </button>
        </div>
        {vault.heirs.length === 0 ? (
          <div className="bg-surface-container-low rounded-xl p-5 text-center text-on-surface-variant text-sm">
            No heirs designated yet.
          </div>
        ) : (
          vault.heirs.map((h) => (
            <div
              key={h.addr}
              className="bg-surface-container-lowest rounded-xl p-4 flex items-center justify-between card-shadow border border-outline-variant/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant text-sm">
                  <Icon name="person" />
                </div>
                <span className="text-sm text-on-surface font-medium">
                  {shortAddr(h.addr, 6)}
                </span>
              </div>
              <div className="text-lg font-bold text-primary-container">
                {(h.bps / 100).toFixed(0)}%
              </div>
            </div>
          ))
        )}
      </section>

      {/* Social recovery entry */}
      <button
        onClick={() => navigate('/recovery')}
        className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/20 flex items-center justify-between hover:opacity-90 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center">
            <Icon name="shield_person" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium">Social recovery</div>
            <div className="text-xs text-on-surface-variant">
              Add guardians to recover a lost device
            </div>
          </div>
        </div>
        <Icon name="arrow_forward" className="text-on-surface-variant" />
      </button>

      {vault.error && (
        <p className="text-error text-sm text-center">{vault.error}</p>
      )}
    </Layout>
  )
}

function QuickAction({
  icon,
  label,
  onClick,
  tone = 'primary',
}: {
  icon: string
  label: string
  onClick: () => void
  tone?: 'primary' | 'amber' | 'muted'
}) {
  const bg =
    tone === 'amber'
      ? 'bg-secondary-container/10 text-secondary-container'
      : tone === 'muted'
        ? 'bg-surface-variant text-on-surface-variant'
        : 'bg-primary-container/10 text-primary-container'
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 hover:opacity-80 transition">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bg}`}>
        <Icon name={icon} />
      </div>
      <span className="text-xs text-on-surface">{label}</span>
    </button>
  )
}
