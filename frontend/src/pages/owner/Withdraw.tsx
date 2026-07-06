import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Icon } from '../../components/Icon'
import { useWallet } from '../../contexts/WalletContext'
import { useVault } from '../../lib/hooks/useVault'
import { withdraw } from '../../lib/contract'
import { tokenBySac } from '../../lib/config'

/** Owner reclaims funds from their own vault back to their wallet. The inverse
 *  of Deposit — an on-chain Soroban `withdraw`. Blocked once the vault has
 *  timed out and heirs are claiming (enforced on-chain; we guard here too). */
export function Withdraw() {
  const { address } = useWallet()
  const vault = useVault(address)
  const navigate = useNavigate()
  const [sac, setSac] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default the selection to the first held token once loaded.
  const selectedSac = sac ?? vault.tokens[0]?.sac ?? null
  const selected = vault.tokens.find((t) => t.sac === selectedSac) ?? null
  const info = selected ? tokenBySac(selected.sac) : null
  const balance = selected && info
    ? Number(selected.balanceStroops) / 10 ** info.decimals
    : 0

  const distributing = vault.status === 'Distributing'
  const value = parseFloat(amount)
  const valid =
    !!vault.vaultId &&
    !!selected &&
    !distributing &&
    !isNaN(value) &&
    value > 0 &&
    value <= balance

  async function onWithdraw() {
    if (!address || !vault.vaultId || !selected || !info || !valid) return
    setBusy(true)
    setError(null)
    try {
      const stroops = BigInt(Math.round(value * 10 ** info.decimals))
      await withdraw(vault.vaultId, address, selected.sac, stroops)
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
          <h2 className="text-2xl font-semibold">Withdraw from vault</h2>
          <p className="text-on-surface-variant mt-1">
            Move funds from your vault back to your connected wallet.
          </p>
        </div>

        {vault.loading ? (
          <div className="flex items-center gap-2 text-on-surface-variant py-8 justify-center">
            <Icon name="progress_activity" className="animate-spin" /> Loading
            balances…
          </div>
        ) : !vault.vaultId ? (
          <p className="text-on-surface-variant">You don’t have a vault yet.</p>
        ) : vault.tokens.length === 0 ? (
          <p className="text-on-surface-variant">
            This vault holds no funds to withdraw.
          </p>
        ) : (
          <>
            {distributing && (
              <div className="bg-error-container/40 text-on-error-container rounded-xl p-4 text-sm flex items-center gap-2">
                <Icon name="lock" className="text-base" />
                Withdrawals are locked while heirs are claiming.
              </div>
            )}

            {/* Token picker — only tokens the vault actually holds */}
            <section className="bg-surface-container-lowest rounded-2xl p-5 card-shadow border border-outline-variant/30 flex flex-col gap-3">
              <label className="text-xs uppercase tracking-wider text-on-surface-variant">
                Token
              </label>
              <div className="flex gap-2 flex-wrap">
                {vault.tokens.map((t) => {
                  const ti = tokenBySac(t.sac)
                  const active = selectedSac === t.sac
                  return (
                    <button
                      key={t.sac}
                      onClick={() => {
                        setSac(t.sac)
                        setAmount('')
                      }}
                      className={`px-4 h-11 rounded-full font-semibold border transition ${
                        active
                          ? 'bg-primary-container text-on-primary border-primary-container'
                          : 'bg-surface border-outline-variant/40'
                      }`}
                    >
                      {ti.symbol}
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Amount + available balance */}
            <section className="bg-surface-container-lowest rounded-2xl p-6 card-shadow border border-outline-variant/30">
              <div className="flex justify-between items-center">
                <label className="text-xs uppercase tracking-wider text-on-surface-variant">
                  Amount
                </label>
                <button
                  onClick={() => setAmount(String(balance))}
                  className="text-xs font-semibold text-primary-container"
                >
                  Max: {balance.toLocaleString()} {info?.symbol}
                </button>
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-4xl font-bold outline-none mt-2 placeholder:text-outline-variant"
              />
              {!isNaN(value) && value > balance && (
                <p className="text-error text-xs mt-2">
                  Exceeds vault balance.
                </p>
              )}
            </section>

            {error && <p className="text-error text-sm break-words">{error}</p>}

            <button
              onClick={onWithdraw}
              disabled={busy || !valid}
              className="w-full h-14 rounded-full bg-primary-container text-on-primary font-semibold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-60 card-shadow"
            >
              {busy ? 'Confirming…' : 'Withdraw'}
              {!busy && <Icon name="arrow_upward" />}
            </button>
          </>
        )}
      </div>
    </Layout>
  )
}
