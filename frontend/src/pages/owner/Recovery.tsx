import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Icon } from '../../components/Icon'
import { useWallet } from '../../contexts/WalletContext'
import { useFeedback } from '../../contexts/FeedbackContext'
import {
  getAccountSecurity,
  addGuardian,
  removeGuardian,
  setRecoveryPolicy,
  recommendedThreshold,
  guardiansCanRecover,
  isThresholdUnsafe,
  type Signer,
  type Thresholds,
} from '../../lib/recovery'
import { shortAddr } from '../../lib/config'

const isStellarAddr = (a: string) => /^G[A-Z2-7]{55}$/.test(a.trim())

export function Recovery() {
  const { address } = useWallet()
  const { runTx } = useFeedback()
  const navigate = useNavigate()
  const [signers, setSigners] = useState<Signer[]>([])
  const [thresholds, setThresholds] = useState<Thresholds>({ low: 0, med: 0, high: 0 })
  const [loading, setLoading] = useState(true)
  const [guardian, setGuardian] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      const sec = await getAccountSecurity(address)
      setSigners(sec.signers)
      setThresholds(sec.thresholds)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    load()
  }, [load])

  const guardians = signers.filter((s) => s.key !== address)

  async function onAdd() {
    if (!address || !isStellarAddr(guardian)) return
    const g = guardian.trim()
    const { ok } = await runTx({
      confirm: {
        title: 'Add guardian',
        description: `Add ${shortAddr(g, 6)} as a recovery signer on your account.`,
        confirmLabel: 'Add guardian',
      },
      pendingTitle: 'Adding guardian…',
      successTitle: 'Guardian added',
      successDescription: 'They can now help you recover access.',
      action: () => addGuardian(address, g),
    })
    if (ok) {
      setGuardian('')
      await load()
    }
  }

  async function onRemove(key: string) {
    if (!address) return
    const { ok } = await runTx({
      confirm: {
        title: 'Remove guardian',
        description: `Remove ${shortAddr(key, 6)} as a recovery signer.`,
        confirmLabel: 'Remove',
        tone: 'danger',
      },
      pendingTitle: 'Removing guardian…',
      successTitle: 'Guardian removed',
      action: () => removeGuardian(address, key),
    })
    if (ok) await load()
  }

  const threshold = recommendedThreshold(guardians.length)
  const unsafe = isThresholdUnsafe(guardians.length, thresholds)
  const canRecover = guardiansCanRecover(guardians.length, threshold)

  async function onEnforce() {
    if (!address) return
    const { ok } = await runTx({
      confirm: {
        title: `Require ${threshold} signatures`,
        description: `Guardians will each hold weight 1 and every threshold rises to ${threshold}. No single guardian can act alone. You keep weight ${threshold}, so you can still sign by yourself.`,
        confirmLabel: `Require ${threshold}-of-${guardians.length}`,
      },
      pendingTitle: 'Updating account thresholds…',
      successTitle: 'Multisig enforced',
      successDescription: `${threshold} of your ${guardians.length} guardians are now needed to recover this account.`,
      action: () => setRecoveryPolicy(address, threshold),
    })
    if (ok) await load()
  }

  return (
    <Layout>
      <div className="flex flex-col gap-5 pt-2">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-on-surface-variant flex items-center gap-1 text-sm mb-2"
          >
            <Icon name="arrow_back" className="text-base" /> Back
          </button>
          <h2 className="text-2xl font-semibold">Social recovery</h2>
          <p className="text-on-surface-variant mt-1">
            Add trusted guardians as extra signers. If you lose your device,
            guardians can help recover access — native Stellar multisig, no
            company involved.
          </p>
        </div>

        {!loading && guardians.length > 0 && (
          <section
            className={`rounded-2xl p-5 border flex flex-col gap-3 ${
              unsafe
                ? 'bg-error-container/15 border-error/40'
                : 'bg-surface-container-lowest border-outline-variant/30 card-shadow'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon
                name={unsafe ? 'warning' : 'verified_user'}
                className={unsafe ? 'text-error' : 'text-primary-container'}
              />
              <h3 className="font-semibold">
                {unsafe ? 'Guardians can act alone' : 'Multisig enforced'}
              </h3>
            </div>

            {unsafe ? (
              <p className="text-sm text-on-surface-variant">
                Your account thresholds are{' '}
                <b>
                  {thresholds.low}/{thresholds.med}/{thresholds.high}
                </b>
                . Any single guardian can currently sign <b>any</b> transaction on
                this account — including moving funds or removing you as a signer.
                Require multiple signatures to fix this.
              </p>
            ) : (
              <p className="text-sm text-on-surface-variant">
                Thresholds are{' '}
                <b>
                  {thresholds.low}/{thresholds.med}/{thresholds.high}
                </b>
                . No single guardian can act alone. You can still sign by yourself.
              </p>
            )}

            {!canRecover && (
              <p className="text-xs text-on-surface-variant bg-surface-container-low rounded-lg px-3 py-2">
                With only {guardians.length} guardian
                {guardians.length === 1 ? '' : 's'} they cannot reach a threshold of{' '}
                {threshold} on their own, so they could not recover your account
                without you. Add at least {threshold} guardians.
              </p>
            )}

            {unsafe && (
              <button
                onClick={onEnforce}
                className="h-12 rounded-full bg-primary-container text-on-primary font-semibold uppercase tracking-wider text-sm card-shadow"
              >
                Require {threshold} of {guardians.length} signatures
              </button>
            )}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold px-1">
            Guardians ({guardians.length})
          </h3>
          {loading ? (
            <div className="flex justify-center py-8 text-on-surface-variant">
              <Icon name="progress_activity" className="animate-spin text-2xl" />
            </div>
          ) : guardians.length === 0 ? (
            <div className="bg-surface-container-low rounded-xl p-5 text-center text-on-surface-variant text-sm">
              No guardians yet.
            </div>
          ) : (
            guardians.map((g) => (
              <div
                key={g.key}
                className="bg-surface-container-lowest rounded-xl p-4 flex items-center justify-between card-shadow border border-outline-variant/20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center">
                    <Icon name="shield_person" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{shortAddr(g.key, 6)}</span>
                    <span className="text-xs text-on-surface-variant">
                      weight {g.weight}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onRemove(g.key)}
                  className="w-9 h-9 rounded-lg text-error hover:bg-error-container/40 flex items-center justify-center"
                >
                  <Icon name="delete" />
                </button>
              </div>
            ))
          )}
        </section>

        <section className="bg-surface-container-lowest rounded-2xl p-5 card-shadow border border-outline-variant/30 flex flex-col gap-3">
          <label className="text-xs uppercase tracking-wider text-on-surface-variant">
            Add a guardian
          </label>
          <input
            value={guardian}
            onChange={(e) => setGuardian(e.target.value)}
            placeholder="Guardian Stellar address (G…)"
            className="bg-surface-container-low rounded-lg px-3 py-3 text-sm outline-none"
          />
          <button
            onClick={onAdd}
            disabled={!isStellarAddr(guardian)}
            className="h-12 rounded-full bg-primary-container text-on-primary font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Add Guardian
            <Icon name="add" />
          </button>
        </section>

        {error && <p className="text-error text-sm break-words">{error}</p>}
      </div>
    </Layout>
  )
}
