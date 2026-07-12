import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Icon } from '../../components/Icon'
import { useWallet } from '../../contexts/WalletContext'
import { useFeedback } from '../../contexts/FeedbackContext'
import { useVault } from '../../lib/hooks/useVault'
import { setHeirs } from '../../lib/contract'
import { demoCaptureEnabled, demoHeirs } from '../../lib/devDemo'

interface Row {
  addr: string
  pct: string
}

const isStellarAddr = (a: string) => /^G[A-Z2-7]{55}$/.test(a.trim())

export function ManageHeirs() {
  const { address } = useWallet()
  const vault = useVault(address)
  const { runTx } = useFeedback()
  const navigate = useNavigate()

  const [rows, setRows] = useState<Row[]>(() =>
    demoCaptureEnabled()
      ? demoHeirs.map((h) => ({ addr: h.addr, pct: String(h.bps / 100) }))
      : [{ addr: '', pct: '' }],
  )

  // Seed from existing heirs once loaded.
  useEffect(() => {
    if (demoCaptureEnabled()) return
    if (vault.heirs.length > 0) {
      setRows(vault.heirs.map((h) => ({ addr: h.addr, pct: String(h.bps / 100) })))
    }
  }, [vault.heirs])

  const total = rows.reduce((s, r) => s + (parseFloat(r.pct) || 0), 0)
  const totalOk = Math.abs(total - 100) < 0.001
  const addrsOk = rows.every((r) => isStellarAddr(r.addr))
  const canSave = totalOk && addrsOk && !!vault.vaultId
  const noVault = !vault.vaultId && !vault.loading

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }
  const addRow = () => setRows((rs) => [...rs, { addr: '', pct: '' }])
  const removeRow = (i: number) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))

  async function onSave() {
    if (!address || !vault.vaultId) return
    const heirs = rows.map((r) => ({
      addr: r.addr.trim(),
      bps: Math.round(parseFloat(r.pct) * 100),
    }))
    const { ok } = await runTx({
      confirm: {
        title: 'Save heirs',
        description: `Set ${heirs.length} heir${heirs.length === 1 ? '' : 's'} for your vault. Shares total ${total.toFixed(0)}%.`,
        confirmLabel: 'Save heirs',
      },
      pendingTitle: 'Saving heirs…',
      successTitle: 'Heirs saved',
      successDescription: 'Your inheritance shares are now on-chain.',
      action: () => setHeirs(vault.vaultId!, address, heirs),
    })
    if (ok) navigate('/dashboard', { replace: true })
  }

  return (
    <Layout>
      <div className="flex flex-col gap-5 pt-2">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-on-surface-variant flex items-center gap-1 text-sm mb-2"
          >
            <Icon name="arrow_back" className="text-base" /> Back
          </button>
          <h2 className="text-2xl font-semibold">Manage heirs</h2>
          <p className="text-on-surface-variant mt-1">
            Assign each heir a share. Shares must total exactly 100%.
          </p>
        </div>

        <div className="relative">
          <div
            className={`flex flex-col gap-5 ${
              noVault ? 'pointer-events-none blur-[2px] opacity-50 select-none' : ''
            }`}
          >
            <div className="flex flex-col gap-3">
              {rows.map((r, i) => {
            const badAddr = r.addr.length > 0 && !isStellarAddr(r.addr)
            return (
              <div
                key={i}
                className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/30 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={r.addr}
                    onChange={(e) => update(i, { addr: e.target.value })}
                    placeholder="Heir Stellar address (G…)"
                    className={`flex-grow bg-surface-container-low rounded-lg px-3 py-2 text-sm outline-none border ${
                      badAddr ? 'border-error' : 'border-transparent'
                    }`}
                  />
                  <button
                    onClick={() => removeRow(i)}
                    className="w-9 h-9 rounded-lg text-on-surface-variant hover:bg-surface-container flex items-center justify-center flex-shrink-0"
                  >
                    <Icon name="close" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={r.pct}
                    onChange={(e) => update(i, { pct: e.target.value })}
                    placeholder="0"
                    className="w-24 bg-surface-container-low rounded-lg px-3 py-2 text-sm outline-none"
                  />
                  <span className="text-on-surface-variant text-sm">% share</span>
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={addRow}
          className="self-start flex items-center gap-1 text-primary-container font-semibold text-sm"
        >
          <Icon name="add" className="text-base" /> Add heir
        </button>

        {/* Live total validator */}
        <div
          className={`rounded-xl p-4 flex items-center justify-between ${
            totalOk ? 'bg-primary-container/10 text-primary-container' : 'bg-error-container text-error'
          }`}
        >
          <span className="font-semibold">Total</span>
          <span className="font-bold text-lg">{total.toFixed(0)}%</span>
        </div>

            <button
              onClick={onSave}
              disabled={!canSave}
              className="w-full h-14 rounded-full bg-primary-container text-on-primary font-semibold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 card-shadow"
            >
              Save Heirs
              <Icon name="check" />
            </button>
          </div>

          {noVault && (
            <div className="absolute inset-0 flex items-center justify-center p-2">
              <div className="bg-surface-container-lowest rounded-2xl p-6 card-shadow border border-outline-variant/30 flex flex-col items-center text-center gap-3 max-w-[17rem]">
                <div className="w-14 h-14 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center">
                  <Icon name="lock" className="text-3xl" />
                </div>
                <h3 className="text-lg font-semibold">No vault yet</h3>
                <p className="text-on-surface-variant text-sm">
                  Create your inheritance vault before you can assign heirs.
                </p>
                <button
                  onClick={() => navigate('/create')}
                  className="bg-primary-container text-on-primary h-12 px-6 rounded-full font-semibold uppercase tracking-wider hover:opacity-90 active:scale-95 transition card-shadow"
                >
                  Create My Vault
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}

