import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Icon } from '../../components/Icon'
import { useWallet } from '../../contexts/WalletContext'
import { useFeedback } from '../../contexts/FeedbackContext'
import { useVault } from '../../lib/hooks/useVault'
import { deposit } from '../../lib/contract'
import { allTokens, addUserToken, type TokenInfo } from '../../lib/config'
import { readTokenMeta } from '../../lib/token'

const isContractAddr = (a: string) => /^C[A-Z2-7]{55}$/.test(a.trim())

export function Deposit() {
  const { address } = useWallet()
  const vault = useVault(address)
  const { runTx } = useFeedback()
  const navigate = useNavigate()

  const [tokens, setTokens] = useState<TokenInfo[]>(() => allTokens())
  const [selected, setSelected] = useState(tokens[0])
  const [amount, setAmount] = useState('')

  // Add-token sub-form.
  const [adding, setAdding] = useState(false)
  const [newSac, setNewSac] = useState('')
  const [reading, setReading] = useState(false)
  const [addErr, setAddErr] = useState<string | null>(null)

  const value = parseFloat(amount)
  const valid = !isNaN(value) && value > 0 && !!vault.vaultId

  async function onAddToken() {
    if (!address || !isContractAddr(newSac)) return
    setReading(true)
    setAddErr(null)
    try {
      const meta = await readTokenMeta(newSac.trim(), address)
      const info: TokenInfo = {
        symbol: meta.symbol,
        sac: newSac.trim(),
        decimals: meta.decimals,
      }
      const next = addUserToken(info)
      const merged = allTokens()
      setTokens(merged)
      setSelected(info)
      void next
      setAdding(false)
      setNewSac('')
    } catch (e) {
      setAddErr(
        e instanceof Error
          ? `Couldn't read that token: ${e.message}`
          : 'Invalid token contract',
      )
    } finally {
      setReading(false)
    }
  }

  async function onDeposit() {
    if (!address || !vault.vaultId || !valid) return
    const stroops = BigInt(Math.round(value * 10 ** selected.decimals))
    const { ok } = await runTx({
      confirm: {
        title: 'Deposit to vault',
        description: `Fund your vault with ${value.toLocaleString()} ${selected.symbol}.`,
        confirmLabel: 'Deposit',
      },
      pendingTitle: 'Depositing…',
      successTitle: 'Deposit complete',
      successDescription: `${value.toLocaleString()} ${selected.symbol} is now in your vault.`,
      action: () => deposit(vault.vaultId!, address, selected.sac, stroops),
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
          <h2 className="text-2xl font-semibold">Deposit to vault</h2>
          <p className="text-on-surface-variant mt-1">
            Fund your vault with any Stellar asset. Add more than one — heirs
            inherit their share of each.
          </p>
        </div>

        {/* Token picker */}
        <section className="bg-surface-container-lowest rounded-2xl p-5 card-shadow border border-outline-variant/30 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-wider text-on-surface-variant">
              Token
            </label>
            <button
              onClick={() => setAdding((v) => !v)}
              className="text-primary-container text-sm font-semibold flex items-center gap-1"
            >
              <Icon name={adding ? 'close' : 'add'} className="text-base" />
              {adding ? 'Cancel' : 'Add token'}
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {tokens.map((t) => (
              <button
                key={t.sac}
                onClick={() => setSelected(t)}
                className={`px-4 h-11 rounded-full font-semibold border transition ${
                  selected.sac === t.sac
                    ? 'bg-primary-container text-on-primary border-primary-container'
                    : 'bg-surface border-outline-variant/40'
                }`}
              >
                {t.symbol}
              </button>
            ))}
          </div>

          {adding && (
            <div className="flex flex-col gap-2 pt-1">
              <input
                value={newSac}
                onChange={(e) => setNewSac(e.target.value)}
                placeholder="Token contract address (C…)"
                className="bg-surface-container-low rounded-lg px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={onAddToken}
                disabled={reading || !isContractAddr(newSac)}
                className="h-11 rounded-full bg-primary-container text-on-primary font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {reading ? 'Reading token…' : 'Add this token'}
                {!reading && <Icon name="search" className="text-base" />}
              </button>
              {addErr && <p className="text-error text-xs break-words">{addErr}</p>}
              <p className="text-xs text-on-surface-variant">
                Paste any Stellar token's contract (SAC) address — we read its
                symbol automatically and remember it on this device.
              </p>
            </div>
          )}
        </section>

        <section className="bg-surface-container-lowest rounded-2xl p-6 card-shadow border border-outline-variant/30">
          <label className="text-xs uppercase tracking-wider text-on-surface-variant">
            Amount ({selected.symbol})
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

        <button
          onClick={onDeposit}
          disabled={!valid}
          className="w-full h-14 rounded-full bg-primary-container text-on-primary font-semibold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-60 card-shadow"
        >
          Deposit {selected.symbol}
          <Icon name="arrow_downward" />
        </button>
      </div>
    </Layout>
  )
}
