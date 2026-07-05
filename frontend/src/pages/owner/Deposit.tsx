import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Icon } from '../../components/Icon'
import { useWallet } from '../../contexts/WalletContext'
import { useVault } from '../../lib/hooks/useVault'
import { deposit } from '../../lib/contract'
import { STROOPS_PER_UNIT } from '../../lib/config'

export function Deposit() {
  const { address } = useWallet()
  const vault = useVault(address)
  const navigate = useNavigate()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const value = parseFloat(amount)
  const valid = !isNaN(value) && value > 0

  async function onDeposit() {
    if (!address || !vault.vaultId || !valid) return
    setBusy(true)
    setError(null)
    try {
      const stroops = BigInt(Math.round(value * STROOPS_PER_UNIT))
      await deposit(vault.vaultId, address, stroops)
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
          <h2 className="text-2xl font-semibold">Deposit to vault</h2>
          <p className="text-on-surface-variant mt-1">
            Move funds from your wallet into your inheritance vault.
          </p>
        </div>

        <section className="bg-surface-container-lowest rounded-2xl p-6 card-shadow border border-outline-variant/30">
          <label className="text-xs uppercase tracking-wider text-on-surface-variant">
            Amount (XLM)
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

        {error && <p className="text-error text-sm">{error}</p>}

        <button
          onClick={onDeposit}
          disabled={busy || !valid || !vault.vaultId}
          className="w-full h-14 rounded-full bg-primary-container text-on-primary font-semibold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-60 card-shadow"
        >
          {busy ? 'Confirming…' : 'Deposit'}
          {!busy && <Icon name="arrow_downward" />}
        </button>
      </div>
    </Layout>
  )
}
