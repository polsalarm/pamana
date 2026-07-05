import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Icon } from '../../components/Icon'
import { useWallet } from '../../contexts/WalletContext'
import { createVault } from '../../lib/contract'

const PRESETS = [
  { label: '30 days', seconds: 30 * 86400 },
  { label: '60 days', seconds: 60 * 86400 },
  { label: '90 days', seconds: 90 * 86400 },
]

export function CreateVault() {
  const { address } = useWallet()
  const navigate = useNavigate()
  const [seconds, setSeconds] = useState(PRESETS[2].seconds)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onCreate() {
    if (!address) return
    setBusy(true)
    setError(null)
    try {
      await createVault(address, seconds)
      navigate('/dashboard', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6 pt-2">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-on-surface-variant flex items-center gap-1 text-sm mb-2"
          >
            <Icon name="arrow_back" className="text-base" /> Back
          </button>
          <h2 className="text-2xl font-semibold">Create your vault</h2>
          <p className="text-on-surface-variant mt-1">
            Choose how often you'll prove you're active. If you go silent past
            this window, your heirs can claim.
          </p>
        </div>

        <section className="bg-surface-container-lowest rounded-2xl p-6 card-shadow border border-outline-variant/30">
          <span className="text-xs uppercase tracking-wider text-on-surface-variant">
            Check-in window
          </span>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setSeconds(p.seconds)}
                className={`h-14 rounded-xl font-semibold border transition ${
                  seconds === p.seconds
                    ? 'bg-primary-container text-on-primary border-primary-container'
                    : 'bg-surface border-outline-variant/40 text-on-surface hover:border-primary-container/50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        <div className="bg-surface-container-low rounded-xl p-4 flex items-start gap-3 text-sm text-on-surface-variant">
          <Icon name="info" className="text-primary-container" />
          <p>
            A fresh, isolated vault contract is deployed just for your wallet.
            You can fund it and add heirs right after.
          </p>
        </div>

        {error && <p className="text-error text-sm">{error}</p>}

        <button
          onClick={onCreate}
          disabled={busy}
          className="w-full h-14 rounded-full bg-primary-container text-on-primary font-semibold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-60 card-shadow"
        >
          {busy ? 'Deploying…' : 'Create My Vault'}
          {!busy && <Icon name="add_home" fill />}
        </button>
      </div>
    </Layout>
  )
}
