import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { StatusLight, statusText } from './StatusLight'
import { useWallet } from '../contexts/WalletContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { useVault } from '../lib/hooks/useVault'
import { checkIn } from '../lib/contract'
import { shortAddr, tokenBySac, type TokenInfo } from '../lib/config'
import { enablePushReminders, pushEnabled, pushSupported, notify, notifyOnce } from '../lib/push'
import { getAttestation, type Attestation } from '../lib/oracle'
import { demoCaptureEnabled, demoAttestation } from '../lib/devDemo'

function timeAgo(tsSeconds: bigint): string {
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - Number(tsSeconds))
  if (secs < 3600) return `${Math.max(1, Math.floor(secs / 60))}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function daysLeft(heartbeat: bigint, timeout: bigint): number {
  const now = Math.floor(Date.now() / 1000)
  const remaining = Number(heartbeat + timeout) - now
  return Math.max(0, Math.ceil(remaining / 86400))
}

/** The owner's vault UI: proof-of-life check-in, balances + quick actions,
 *  heirs, and recovery. Shared by Home (main feature) and the Vault tab. */
export function VaultPanel() {
  const { address } = useWallet()
  const vault = useVault(address)
  const { runTx, toast } = useFeedback()
  const navigate = useNavigate()
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => {
    pushEnabled().then(setPushOn)
  }, [])

  // Deadline-aware reminders — polled client-side (useVault refreshes every
  // 8s) rather than via cron: this app's demo mode uses 30-60s timeouts, far
  // shorter than Vercel Cron's once-a-day minimum on the free tier, so a
  // schedule-based check would never fire in time to matter for a demo.
  useEffect(() => {
    if (!pushOn || !address || !vault.vaultId || vault.timeout <= 0n) return
    const now = BigInt(Math.floor(Date.now() / 1000))
    if (vault.status === 'Alive') {
      const remaining = vault.heartbeat + vault.timeout - now
      if (remaining > 0n && remaining <= vault.timeout / 5n) {
        notifyOnce(`${vault.vaultId}:reminder:${vault.heartbeat}`, () =>
          notify(
            address,
            'Check in soon',
            'Your inheritance countdown is running low — tap "I\'m Alive" to reset it.',
          ),
        )
      }
    } else if (vault.status === 'TimedOut') {
      notifyOnce(`${vault.vaultId}:timedout:${vault.heartbeat}`, () =>
        notify(
          address,
          'Vault timed out',
          'Your check-in window passed — heirs can now claim their share.',
        ),
      )
    }
  }, [pushOn, address, vault.vaultId, vault.status, vault.heartbeat, vault.timeout])

  async function onEnableReminders() {
    if (!address) return
    setPushBusy(true)
    try {
      await enablePushReminders(address)
      setPushOn(true)
      toast('Check-in reminders enabled', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not enable reminders', 'error')
    } finally {
      setPushBusy(false)
    }
  }

  async function onCheckIn() {
    if (!vault.vaultId || !address) return
    const { ok } = await runTx({
      pendingTitle: 'Confirming you’re alive…',
      successTitle: "You're alive ✓",
      successDescription: 'The inheritance countdown has been reset.',
      action: () => checkIn(vault.vaultId!, address),
    })
    if (ok) await vault.refresh()
  }

  if (vault.loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-on-surface-variant">
        <Icon name="progress_activity" className="animate-spin text-2xl" />
        <p className="text-sm">Loading your vault…</p>
      </div>
    )
  }

  // No vault yet → create CTA.
  if (!vault.vaultId) {
    return (
      <section className="bg-surface-container-lowest rounded-2xl p-6 card-shadow border border-outline-variant/30 flex flex-col items-center text-center gap-3">
        <div className="w-14 h-14 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center">
          <Icon name="lock" className="text-3xl" />
        </div>
        <h2 className="text-xl font-semibold">Protect your family</h2>
        <p className="text-on-surface-variant text-sm max-w-xs">
          Create your personal inheritance vault to start passing on assets.
        </p>
        <button
          onClick={() => navigate('/create')}
          className="bg-primary-container text-on-primary h-14 px-8 rounded-full font-semibold uppercase tracking-wider hover:opacity-90 active:scale-95 transition card-shadow"
        >
          Create My Vault
        </button>
      </section>
    )
  }

  const days = daysLeft(vault.heartbeat, vault.timeout)
  const alive = vault.status === 'Alive'

  return (
    <>
      {/* Heartbeat status card */}
      <section className="bg-surface-container-lowest rounded-2xl p-6 card-shadow flex flex-col items-center text-center border border-outline-variant/30">
        <StatusLight status={vault.status} label={alive ? String(days) : undefined} />
        <h2 className="text-2xl font-semibold mt-3">{statusText(vault.status)}</h2>
        <p className="text-on-surface-variant mb-5">
          {alive ? `Next check-in in ${days} day${days === 1 ? '' : 's'}` : 'Heirs may now claim'}
        </p>
        <button
          onClick={onCheckIn}
          className="w-full h-14 rounded-lg bg-primary-container text-on-primary font-semibold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition"
        >
          <Icon name="favorite" />
          I'm Alive
        </button>
        {pushSupported() && !pushOn && (
          <button
            onClick={onEnableReminders}
            disabled={pushBusy}
            className="mt-3 text-sm text-primary-container font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            <Icon name="notifications" className="text-base" />
            {pushBusy ? 'Enabling…' : 'Enable check-in reminders'}
          </button>
        )}
      </section>

      {/* Vault balances (per token) + quick actions */}
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
                <div key={t.sac} className="flex flex-col gap-0.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-bold">{amt.toLocaleString()}</span>
                    <span className="flex items-center gap-1.5 text-on-surface-variant font-medium">
                      {info.rwa && (
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-secondary-container bg-secondary-container/10 rounded-full px-2 py-0.5">
                          RWA
                        </span>
                      )}
                      {info.symbol}
                    </span>
                  </div>
                  {info.rwa && <RwaMeta info={info} source={address} />}
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

      {vault.error && <p className="text-error text-sm text-center">{vault.error}</p>}
    </>
  )
}

/** RWA valuation row. Reads the oracle attestation for the token's SAC (Phase
 *  2) and shows the attested value, how recent it is, and the signing
 *  appraiser. Falls back to the static config figure if no attestation exists
 *  or the read fails; uses the demo attestation in demo-capture mode. */
function RwaMeta({ info, source }: { info: TokenInfo; source: string | null }) {
  const [att, setAtt] = useState<Attestation | null>(null)
  const rwa = info.rwa!

  useEffect(() => {
    let live = true
    if (demoCaptureEnabled()) {
      setAtt(demoAttestation)
      return
    }
    if (!source) return
    getAttestation(info.sac, source).then((a) => {
      if (live) setAtt(a)
    })
    return () => {
      live = false
    }
  }, [info.sac, source])

  const valuePhp = att ? Number(att.valuePhp) : rwa.attestedPhp

  return (
    <div className="flex items-baseline justify-between text-xs text-on-surface-variant">
      <span>
        {rwa.label} · ≈ ₱{valuePhp.toLocaleString()}
      </span>
      {att ? (
        <span title={`doc ${att.docHash.slice(0, 16)}… · appraiser ${att.appraiser}`}>
          attested {timeAgo(att.timestamp)} · {shortAddr(att.appraiser, 4)}
        </span>
      ) : (
        <span className="italic">{rwa.docRef}</span>
      )}
    </div>
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
