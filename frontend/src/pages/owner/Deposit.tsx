import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Icon } from '../../components/Icon'
import { useWallet } from '../../contexts/WalletContext'
import { useVault } from '../../lib/hooks/useVault'
import { deposit } from '../../lib/contract'
import { KNOWN_TOKENS } from '../../lib/config'

const isContractAddr = (a: string) => /^C[A-Z2-7]{55}$/.test(a.trim())

export function Deposit() {
  const { address } = useWallet()
  const vault = useVault(address)
  const navigate = useNavigate()
  const [amount, setAmount] = useState('')
  const [tokenSac, setTokenSac] = useState(KNOWN_TOKENS[0].sac)
  const [custom, setCustom] = useState('')
  const [decimals, setDecimals] = useState(7)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const usingCustom = tokenSac === 'custom'
  const effectiveSac = usingCustom ? custom.trim() : tokenSac
  const value = parseFloat(amount)
  const valid =
    !isNaN(value) &&
    value > 0 &&
    isContractAddr(effectiveSac) &&
    !!vault.vaultId

  async function onDeposit() {
    if (!address || !vault.vaultId || !valid) return
    setBusy(true)
    setError(null)
    try {
      const stroops = BigInt(Math.round(value * 10 ** decimals))
      await deposit(vault.vaultId, address, effectiveSac, stroops)
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
            Fund your vault with any Stellar asset. Add more than one — heirs
            inherit their share of each.
          </p>
        </div>

        {/* Token picker */}
        <section className="bg-surface-container-lowest rounded-2xl p-5 card-shadow border border-outline-variant/30 flex flex-col gap-3">
          <label className="text-xs uppercase tracking-wider text-on-surface-variant">
            Token
          </label>
          <div className="flex gap-2 flex-wrap">
            {KNOWN_TOKENS.map((t) => (
              <button
                key={t.sac}
                onClick={() => {
                  setTokenSac(t.sac)
                  setDecimals(t.decimals)
                }}
                className={`px-4 h-11 rounded-full font-semibold border transition ${
                  tokenSac === t.sac
                    ? 'bg-primary-container text-on-primary border-primary-container'
                    : 'bg-surface border-outline-variant/40'
                }`}
              >
                {t.symbol}
              </button>
            ))}
            <button
              onClick={() => setTokenSac('custom')}
              className={`px-4 h-11 rounded-full font-semibold border transition ${
                usingCustom
                  ? 'bg-primary-container text-on-primary border-primary-container'
                  : 'bg-surface border-outline-variant/40'
              }`}
            >
              Custom
            </button>
          </div>
          {usingCustom && (
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Token SAC address (C…)"
              className="bg-surface-container-low rounded-lg px-3 py-2 text-sm outline-none"
            />
          )}
        </section>

        <section className="bg-surface-container-lowest rounded-2xl p-6 card-shadow border border-outline-variant/30">
          <label className="text-xs uppercase tracking-wider text-on-surface-variant">
            Amount
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

        {error && <p className="text-error text-sm break-words">{error}</p>}

        <button
          onClick={onDeposit}
          disabled={busy || !valid}
          className="w-full h-14 rounded-full bg-primary-container text-on-primary font-semibold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-60 card-shadow"
        >
          {busy ? 'Confirming…' : 'Deposit'}
          {!busy && <Icon name="arrow_downward" />}
        </button>
      </div>
    </Layout>
  )
}
