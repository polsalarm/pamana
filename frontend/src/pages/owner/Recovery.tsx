import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Icon } from '../../components/Icon'
import { useWallet } from '../../contexts/WalletContext'
import {
  getAccountSecurity,
  addGuardian,
  removeGuardian,
  type Signer,
} from '../../lib/recovery'
import { shortAddr } from '../../lib/config'

const isStellarAddr = (a: string) => /^G[A-Z2-7]{55}$/.test(a.trim())

export function Recovery() {
  const { address } = useWallet()
  const navigate = useNavigate()
  const [signers, setSigners] = useState<Signer[]>([])
  const [loading, setLoading] = useState(true)
  const [guardian, setGuardian] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      const sec = await getAccountSecurity(address)
      setSigners(sec.signers)
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
    setBusy(true)
    setError(null)
    try {
      await addGuardian(address, guardian.trim())
      setGuardian('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onRemove(key: string) {
    if (!address) return
    setBusy(true)
    setError(null)
    try {
      await removeGuardian(address, key)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
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
                  disabled={busy}
                  className="w-9 h-9 rounded-lg text-error hover:bg-error-container/40 flex items-center justify-center disabled:opacity-50"
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
            disabled={busy || !isStellarAddr(guardian)}
            className="h-12 rounded-full bg-primary-container text-on-primary font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? 'Confirming…' : 'Add Guardian'}
            {!busy && <Icon name="add" />}
          </button>
        </section>

        {error && <p className="text-error text-sm break-words">{error}</p>}
      </div>
    </Layout>
  )
}
