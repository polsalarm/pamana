import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Icon } from '../../components/Icon'
import { useWallet } from '../../contexts/WalletContext'
import { useFeedback } from '../../contexts/FeedbackContext'
import {
  getRate,
  getDepositAddress,
  getPdaxBalance,
  waitForCredit,
  withdrawToFiat,
  type RateQuote,
  type WithdrawReceipt,
} from '../../lib/pdax'
import { sendToExchange } from '../../lib/token'
import { consumeLastTxHash } from '../../lib/stellar'
import { explorerTxUrl } from '../../lib/config'
import { demoCaptureEnabled, demoQuote } from '../../lib/devDemo'

const PAYOUTS = [
  { id: 'gcash', label: 'GCash', icon: 'account_balance_wallet', fee: 15, hint: 'GCash mobile number' },
  { id: 'maya', label: 'Maya', icon: 'wallet', fee: 15, hint: 'Maya mobile number' },
  { id: 'bank', label: 'Bank', icon: 'account_balance', fee: 25, hint: 'Bank account number' },
]

/** The asset the heir cashes out. Testnet Stellar is native XLM only — PDAX has
 *  no Stellar-testnet USDC wallet. `SELL_SYMBOL` is the trading pair symbol;
 *  `DEPOSIT_CODE` is the network-suffixed code used to fetch the wallet. */
const SELL_SYMBOL = 'XLM'
const DEPOSIT_CODE = 'XLM_TEST'

/** Off-ramp: convert claimed XLM to Philippine pesos via PDAX.
 *
 *  This is a genuine end-to-end chain, not a simulation:
 *    1. ask PDAX for its custody address + memo
 *    2. the heir signs a real Stellar payment into it
 *    3. poll until PDAX credits the deposit
 *    4. SELL XLM→PHP and pay out to GCash / Maya / bank
 *
 *  Steps 1–3 are the part that used to be missing: previously the SELL sold the
 *  institutional account's own balance and the heir's coins never moved. */
export function OffRamp() {
  const navigate = useNavigate()
  const { address } = useWallet()
  const { runTx } = useFeedback()
  const [amount, setAmount] = useState(() => (demoCaptureEnabled() ? '350' : '100'))
  const [quote, setQuote] = useState<RateQuote | null>(() =>
    demoCaptureEnabled() ? demoQuote : null,
  )
  const [loading, setLoading] = useState(false)
  const [payout, setPayout] = useState('gcash')
  const [destination, setDestination] = useState(() =>
    demoCaptureEnabled() ? '0917 123 4567' : '',
  )
  const [accountName, setAccountName] = useState(() =>
    demoCaptureEnabled() ? 'Maria Dela Cruz' : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<WithdrawReceipt | null>(null)
  /** True when the payout leg was run against PDAX's own exchange balance
   *  instead of the heir's uncredited deposit. Never silent — it badges the
   *  receipt, because otherwise this is indistinguishable from a real cash-out. */
  const [exchangeSideDemo, setExchangeSideDemo] = useState(false)

  const value = parseFloat(amount)
  const valid = !isNaN(value) && value > 0
  const method = PAYOUTS.find((p) => p.id === payout)!
  const fee = method.fee
  const total = quote ? +(quote.php - fee).toFixed(2) : 0
  const canSubmit =
    valid &&
    !!quote &&
    !!address &&
    destination.trim().length > 0 &&
    accountName.trim().length > 0

  useEffect(() => {
    if (demoCaptureEnabled()) {
      setQuote({ ...demoQuote, php: value * demoQuote.rate })
      setLoading(false)
      return
    }
    if (!valid) {
      setQuote(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    const t = setTimeout(async () => {
      try {
        const q = await getRate(value, SELL_SYMBOL)
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
    if (!canSubmit || !address) return
    setError(null)
    // The heir signs one on-chain payment; the rest is PDAX. Confirm + pending
    // via the modal, then the receipt screen below is the success surface.
    const { ok, result } = await runTx<WithdrawReceipt>({
      confirm: {
        title: 'Confirm cash-out',
        description: `${value} ${SELL_SYMBOL} will be sent to PDAX and paid out as ₱${total.toLocaleString()} to your ${method.label} account (rate ₱${quote!.rate.toFixed(2)}). You'll sign the transfer in your wallet.`,
        confirmLabel: `Cash out ₱${total.toLocaleString()}`,
      },
      pendingTitle: 'Sending to PDAX and cashing out…',
      showExplorer: false,
      silentSuccess: true,
      action: async () => {
        // 1. Where does PDAX want the coins, and under which memo?
        const { address: custody, memo } = await getDepositAddress(DEPOSIT_CODE)

        // 2. Snapshot the balance so we can detect the credit.
        const before = await getPdaxBalance(SELL_SYMBOL)

        // 3. Real Stellar payment from the heir's wallet, memo attached.
        await sendToExchange(address, custody, value, memo)
        const depositTxHash = consumeLastTxHash() ?? undefined

        // 4. PDAX credits asynchronously. If it never does we stop here rather
        //    than sell — selling now would liquidate the exchange's own coins
        //    while the heir's sit uncredited.
        const credited = await waitForCredit(SELL_SYMBOL, before, value)
        if (!credited) {
          return {
            status: 'simulated',
            reference: depositTxHash ?? `SIM-${Date.now()}`,
            amountUsdc: value,
            asset: SELL_SYMBOL,
            rate: quote!.rate,
            rateSource: quote!.source,
            rateProvider: quote!.provider,
            php: quote!.php,
            fee,
            net: total,
            method: payout,
            depositTxHash,
            failure: {
              leg: 'deposit',
              message: `PDAX has not credited the ${SELL_SYMBOL} deposit. The transfer is confirmed on-chain; the exchange's sandbox does not credit testnet deposits.`,
            },
          } satisfies WithdrawReceipt
        }

        // 5. Now the SELL is actually selling the heir's coins.
        const receipt = await withdrawToFiat(
          value,
          payout,
          destination.trim(),
          accountName.trim(),
          SELL_SYMBOL,
        )
        return { ...receipt, depositTxHash }
      },
    })
    if (ok && result) setReceipt(result)
  }

  /** Deliberate escape hatch. PDAX's sandbox never credits testnet deposits, so
   *  the peso leg can only be exercised against the exchange's own balance. That
   *  is a demo, not an inheritance — the receipt says so, permanently. */
  async function onDemoPayout() {
    if (!receipt) return
    const { ok, result } = await runTx<WithdrawReceipt>({
      confirm: {
        title: 'Run payout leg (demo)',
        description: `This sells PDAX's own ${SELL_SYMBOL}, not your deposit — your ${value} ${SELL_SYMBOL} is still uncredited on-chain. It exercises the real /trade and /fiat/withdraw calls so you can see a live peso payout. The receipt will be marked as a demo.`,
        confirmLabel: 'Run demo payout',
      },
      pendingTitle: 'Selling and paying out…',
      showExplorer: false,
      silentSuccess: true,
      action: () =>
        withdrawToFiat(value, payout, destination.trim(), accountName.trim(), SELL_SYMBOL),
    })
    if (ok && result) {
      setExchangeSideDemo(true)
      setReceipt({ ...result, depositTxHash: receipt.depositTxHash })
    }
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
            <Row label="Sold" value={`${receipt.amountUsdc} ${receipt.asset}`} />
            <Row label="Rate" value={`₱${receipt.rate.toFixed(2)} / ${receipt.asset}`} />
            <Row label="Gross" value={`₱${receipt.php.toLocaleString()}`} />
            <Row label="Fee" value={`-₱${receipt.fee}`} />
            <hr className="border-outline-variant/40 my-1" />
            <Row label="You receive" value={`₱${receipt.net.toLocaleString()}`} bold />
            <Row label="Reference" value={receipt.reference} mono />
          </section>

          {exchangeSideDemo && (
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-500 bg-amber-500/15 border border-amber-500/40 rounded-lg px-3 py-2 text-left">
              ⚠ DEMO PAYOUT — these pesos came from selling PDAX's own {receipt.asset}.
              Your {value} {receipt.asset} deposit is on-chain but still uncredited by the
              exchange. This is not an inheritance payout.
            </p>
          )}

          {receipt.status === 'simulated' && (
            <p className="text-xs text-secondary bg-secondary-container/15 rounded-lg px-3 py-2 text-left">
              Stopped at the <b>{receipt.failure?.leg ?? 'payout'}</b> step, so no pesos
              were paid out.
              {receipt.failure?.message && (
                <span className="block mt-1 opacity-70">{receipt.failure.message}</span>
              )}
            </p>
          )}

          {receipt.depositTxHash && (
            <a
              href={explorerTxUrl(receipt.depositTxHash)}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-primary flex items-center gap-1"
            >
              View the on-chain transfer <Icon name="open_in_new" className="text-base" />
            </a>
          )}

          {receipt.failure?.leg === 'deposit' && !exchangeSideDemo && (
            <button
              onClick={onDemoPayout}
              className="w-full h-12 rounded-full border border-amber-500/50 text-amber-700 dark:text-amber-500 font-semibold text-sm"
            >
              Run payout leg (demo)
            </button>
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
            Send your claimed {SELL_SYMBOL} to PDAX — a BSP-licensed exchange — and receive pesos.
          </p>
        </div>

        <section className="bg-surface-container-lowest rounded-2xl p-6 card-shadow border border-outline-variant/30">
          <label className="text-xs uppercase tracking-wider text-on-surface-variant">
            Amount ({SELL_SYMBOL})
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
                <span>₱{quote.rate.toFixed(2)} / {SELL_SYMBOL}</span>
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

        {/* Account name — PDAX requires it on every payout. */}
        <section className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wider text-on-surface-variant px-1">
            Account name
          </label>
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Name on the account"
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
