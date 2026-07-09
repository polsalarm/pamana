import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Icon } from '../../components/Icon'
import { useWallet } from '../../contexts/WalletContext'
import { useFeedback } from '../../contexts/FeedbackContext'
import { createVault } from '../../lib/contract'

const PRESETS = [
  { label: '30 days', seconds: 30 * 86400 },
  { label: '60 days', seconds: 60 * 86400 },
  { label: '90 days', seconds: 90 * 86400 },
]

const DEMO_PRESETS = [
  { label: '30 sec', seconds: 30 },
  { label: '60 sec', seconds: 60 },
]

export function CreateVault() {
  const { address } = useWallet()
  const { runTx } = useFeedback()
  const navigate = useNavigate()
  const [seconds, setSeconds] = useState(PRESETS[2].seconds)
  const [demo, setDemo] = useState(false)

  const windowLabel =
    (demo ? DEMO_PRESETS : PRESETS).find((p) => p.seconds === seconds)?.label ??
    `${seconds}s`

  async function onCreate() {
    if (!address) return
    const { ok } = await runTx({
      confirm: {
        title: 'Create your vault',
        description: `A fresh vault contract will be deployed for your wallet with a ${windowLabel} check-in window.`,
        confirmLabel: 'Create vault',
      },
      pendingTitle: 'Deploying your vault…',
      successTitle: 'Vault created',
      successDescription: 'Fund it and add heirs next.',
      action: () => createVault(address, seconds),
    })
    if (ok) navigate('/dashboard', { replace: true })
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
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-on-surface-variant">
              Check-in window
            </span>
            <button
              onClick={() => {
                const next = !demo
                setDemo(next)
                setSeconds(next ? DEMO_PRESETS[1].seconds : PRESETS[2].seconds)
              }}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition ${
                demo
                  ? 'bg-amber-500/15 text-amber-500 border-amber-500/40'
                  : 'text-on-surface-variant border-outline-variant/40 hover:border-primary-container/50'
              }`}
            >
              ⚡ Demo mode
            </button>
          </div>
          <div className={`grid gap-3 mt-3 ${demo ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {(demo ? DEMO_PRESETS : PRESETS).map((p) => (
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
          {demo && (
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-3 flex items-start gap-1.5">
              <Icon name="warning" className="text-sm" />
              Demo timeout. Go silent {seconds}s → status flips to TimedOut → heirs
              can claim. For stage use only, not real inheritance.
            </p>
          )}
        </section>

        <div className="bg-surface-container-low rounded-xl p-4 flex items-start gap-3 text-sm text-on-surface-variant">
          <Icon name="info" className="text-primary-container" />
          <p>
            A fresh, isolated vault contract is deployed just for your wallet.
            You can fund it and add heirs right after.
          </p>
        </div>

        <button
          onClick={onCreate}
          className="w-full h-14 rounded-full bg-primary-container text-on-primary font-semibold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition card-shadow"
        >
          Create My Vault
          <Icon name="add_home" fill />
        </button>
      </div>
    </Layout>
  )
}
