import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Icon } from '../../components/Icon'
import { useFeedback } from '../../contexts/FeedbackContext'
import { getRate, withdrawToFiat, type RateQuote, type WithdrawReceipt } from '../../lib/pdax'

const PAYOUTS = [
  { id: 'gcash', label: 'GCash', icon: 'account_balance_wallet', fee: 15, hint: 'GCash mobile number' },
  { id: 'maya', label: 'Maya', icon: 'wallet', fee: 15, hint: 'Maya mobile number' },
  { id: 'bank', label: 'Bank', icon: 'account_balance', fee: 25, hint: 'Bank account number' },
]

/** Off-ramp: convert claimed USDC to Philippine pesos via PDAX. Live indicative
 *  rate + quote, then execute the payout through /api/pdax-withdraw (keys stay
 *  server-side). UAT OTC is mock, so a payout may come back `simulated`. */
export function OffRamp() {
  const navigate = useNavigate()
  const { runTx } = useFeedback()
  const [amount, setAmount] = useState('100')
  const [quote, setQuote] = useState<RateQuote | null>(null)
  const [loading, setLoading] = useState(false)
  const [payout, setPayout] = useState('gcash')
  const [destination, setDestination] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<WithdrawReceipt | null>(null)

  const value = parseFloat(amount)
  const valid = !isNaN(value) && value > 0
  const method = PAYOUTS.find((p) => p.id === payout)!
  const fee = method.fee
  const total = quote ? +(quote.php - fee).toFixed(2) : 0
  const canSubmit = valid && !!quote && destination.trim().length > 0

  useEffect(() => {
    if (!valid) {
      setQuote(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    const t = setTimeout(async () => {
      try {
        const q = await getRate(value)
        if (!cancelled) setQuote(q)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [value, valid])

  async function onWithdraw() {
    if (!canSubmit) return
    setError(null)
    // Off-chain (PDAX) — no tx hash. Confirm + pending via the modal, then the
    // rich receipt screen below is the success surface (silentSuccess).
    const { ok, result } = await runTx<WithdrawReceipt>({
      confirm: {
        title: 'Confirm cash-out',
        description: `Send ₱${total.toLocaleString()} to your ${method.label} account (${value} USDC at ₱${quote!.rate.toFixed(2)}).`,
        confirmLabel: `Withdraw ₱${total.toLocaleString()}`,
      },
      pendingTitle: 'Sending your payout…',
      showExplorer: false,
      silentSuccess: true,
      action: () => withdrawToFiat(value, payout, destination.trim()),
    })
    if (ok && result) setReceipt(result)
  }

  // ── Success / receipt screen ──────────────────────────────────────────
  if (receipt) {
    return (
      <Layout>
        <div className="flex flex-col items-center text-center gap-5 pt-10">
          <div className="w-20 h-20 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center">
            <Icon name="check_circle" className="text-5xl" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">
              {receipt.status === 'submitted' ? 'Cash-out sent' : 'Cash-out queued'}
            </h2>
            <p className="text-on-surface-variant mt-1">
              ₱{receipt.net.toLocaleString()} to {method.label}
            </p>
          </div>

          <section className="w-full bg-surface-container-lowest rounded-2xl p-5 card-shadow border border-outline-variant/30 flex flex-col gap-2 text-sm text-left">
            <Row label="Sold" value={`${receipt.amountUsdc} USDC`} />
            <Row label="Rate" value={`₱${receipt.rate.toFixed(2)} / USDC`} />
            <Row label="Gross" value={`₱${receipt.php.toLocaleString()}`} />
            <Row label="Fee" value={`-₱${receipt.fee}`} />
            <hr className="border-outline-variant/40 my-1" />
            <Row label="You receive" value={`₱${receipt.net.toLocaleString()}`} bold />
            <Row label="Reference" value={receipt.reference} mono />
          </section>

          {receipt.status === 'simulated' && (
            <p className="text-xs text-secondary bg-secondary-container/15 rounded-lg px-3 py-2">
              Simulated payout — PDAX UAT OTC is mock, so no live PHP moved. The
              rate and flow are real.
            </p>
          )}

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full h-14 rounded-full bg-primary-container text-on-primary font-semibold uppercase tracking-wider card-shadow"
          >
            Done
          </button>
        </div>
      </Layout>
    )
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
          <h2 className="text-2xl font-semibold">Cash out to pesos</h2>
          <p className="text-on-surface-variant mt-1">
            Convert your USDC to PHP via PDAX — a BSP-licensed exchange.
          </p>
        </div>

        <section className="bg-surface-container-lowest rounded-2xl p-6 card-shadow border border-outline-variant/30">
          <label className="text-xs uppercase tracking-wider text-on-surface-variant">
            Amount (USDC)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent text-4xl font-bold outline-none mt-2 placeholder:text-outline-variant"
          />
        </section>

        {/* Live quote */}
        <section className="bg-primary-container/5 rounded-2xl p-5 border border-primary-container/20 flex flex-col gap-2">
          {loading ? (
            <div className="flex items-center gap-2 text-on-surface-variant">
              <Icon name="progress_activity" className="animate-spin" /> Fetching live rate…
            </div>
          ) : quote ? (
            <>
              <div className="flex justify-between items-baseline">
                <span className="text-on-surface-variant text-sm">Gross</span>
                <span className="text-3xl font-bold text-primary-container">
                  ₱{quote.php.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-on-surface-variant">
                <span>₱{quote.rate.toFixed(2)} / USDC</span>
                <span
                  className={`px-2 py-0.5 rounded-full ${
                    quote.source === 'live'
                      ? 'bg-primary-container/15 text-primary-container'
                      : 'bg-secondary-container/20 text-secondary'
                  }`}
                >
                  {quote.source === 'live' ? '● live rate' : 'indicative rate'}
                </span>
              </div>
            </>
          ) : (
            <span className="text-on-surface-variant text-sm">
              Enter an amount to see a quote.
            </span>
          )}
        </section>

        {/* Payout method */}
        <section>
          <span className="text-xs uppercase tracking-wider text-on-surface-variant px-1">
            Payout to
          </span>
          <div className="grid grid-cols-3 gap-3 mt-2">
            {PAYOUTS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPayout(p.id)}
                className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                  payout === p.id
                    ? 'bg-primary-container text-on-primary border-primary-container'
                    : 'bg-surface border-outline-variant/40 text-on-surface'
                }`}
              >
                <Icon name={p.icon} />
                <span className="text-xs">{p.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Destination account */}
        <section className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wider text-on-surface-variant px-1">
            {method.hint}
          </label>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={method.hint}
            className="bg-surface-container-lowest rounded-xl px-4 h-12 outline-none border border-outline-variant/30 card-shadow"
          />
        </section>

        {/* Summary breakdown */}
        {quote && (
          <section className="bg-surface-container-low rounded-2xl p-5 flex flex-col gap-2 text-sm">
            <Row label="Amount to receive" value={`₱${quote.php.toLocaleString()}`} />
            <Row label={`${method.label} fee`} value={`-₱${fee}`} muted />
            <hr className="border-outline-variant/40 my-1" />
            <Row label="Total payout" value={`₱${total.toLocaleString()}`} bold />
          </section>
        )}

        {error && <p className="text-error text-sm break-words">{error}</p>}

        <button
          onClick={onWithdraw}
          disabled={!canSubmit}
          className="w-full h-14 rounded-full bg-primary-container text-on-primary font-semibold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 card-shadow"
        >
          Withdraw ₱{total.toLocaleString()}
          <Icon name="south" />
        </button>
        <p className="text-xs text-on-surface-variant text-center -mt-2">
          Rate is a real PDAX quote (indicative fallback while UAT pricing is
          down). Payout runs against PDAX UAT.
        </p>
      </div>
    </Layout>
  )
}

function Row({
  label,
  value,
  bold,
  muted,
  mono,
}: {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
  mono?: boolean
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={muted ? 'text-on-surface-variant' : 'text-on-surface'}>
        {label}
      </span>
      <span
        className={`${bold ? 'font-bold text-primary-container' : ''} ${
          mono ? 'font-mono text-xs' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}
