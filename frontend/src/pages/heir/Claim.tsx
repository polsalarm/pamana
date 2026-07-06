import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Icon } from '../../components/Icon'
import { StatusLight, statusText } from '../../components/StatusLight'
import { useWallet } from '../../contexts/WalletContext'
import { nfcSupported, readClaimCard } from '../../lib/nfc'
import {
  getVault,
  getStatus,
  getHeirs,
  getVaultBalance,
  claim,
  type VaultStatus,
} from '../../lib/contract'
import { STROOPS_PER_UNIT } from '../../lib/config'

const isStellarAddr = (a: string) => /^G[A-Z2-7]{55}$/.test(a.trim())

interface Found {
  vaultId: string
  status: VaultStatus
  sharePct: number
  claimed: boolean
  estimateXlm: number
}

export function Claim() {
  const { address } = useWallet()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [owner, setOwner] = useState('')
  const [loading, setLoading] = useState(false)
  const [found, setFound] = useState<Found | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [done, setDone] = useState(false)
  const [scanning, setScanning] = useState(false)

  const lookup = useCallback(
    async (ownerArg?: string) => {
      const o = (ownerArg ?? owner).trim()
      if (!address || !isStellarAddr(o)) return
      setLoading(true)
      setError(null)
      setFound(null)
      try {
        const vaultId = await getVault(o)
      if (!vaultId) {
        setError('No vault found for that address.')
        return
      }
      const [status, heirs, balance] = await Promise.all([
        getStatus(vaultId, address),
        getHeirs(vaultId, address),
        getVaultBalance(vaultId, address),
      ])
      const me = heirs.find((h) => h.addr === address)
      if (!me) {
        setError('Your wallet is not listed as an heir of this vault.')
        return
      }
      setFound({
        vaultId,
        status,
        sharePct: me.bps / 100,
        claimed: me.claimed,
        estimateXlm: (Number(balance) / STROOPS_PER_UNIT) * (me.bps / 10000),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
    },
    [address, owner],
  )

  // Deep-link from an NFC card / QR: /claim?owner=G... → auto lookup.
  useEffect(() => {
    const qp = searchParams.get('owner')
    if (qp && isStellarAddr(qp) && address) {
      setOwner(qp)
      void lookup(qp)
    }
  }, [searchParams, address, lookup])

  async function onScan() {
    setScanning(true)
    setError(null)
    try {
      const scanned = await readClaimCard()
      setOwner(scanned)
      await lookup(scanned)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setScanning(false)
    }
  }

  async function onClaim() {
    if (!address || !found) return
    setClaiming(true)
    setError(null)
    try {
      await claim(found.vaultId, address, address)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setClaiming(false)
    }
  }

  const unlocked =
    found && (found.status === 'TimedOut' || found.status === 'Distributing')

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
          <h2 className="text-2xl font-semibold">Claim an inheritance</h2>
          <p className="text-on-surface-variant mt-1">
            Enter the address of the person who named you as an heir.
          </p>
        </div>

        {done ? (
          <div className="flex flex-col items-center text-center py-10 gap-4">
            <div className="w-20 h-20 rounded-full bg-primary-container text-on-primary flex items-center justify-center">
              <Icon name="check" className="text-4xl" />
            </div>
            <h3 className="text-2xl font-semibold">Claim complete</h3>
            <p className="text-on-surface-variant max-w-xs">
              Your share has been transferred to your wallet.
            </p>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="Owner Stellar address (G…)"
                className="flex-grow bg-surface-container-low rounded-lg px-3 py-3 text-sm outline-none"
              />
              <button
                onClick={() => lookup()}
                disabled={!isStellarAddr(owner) || loading}
                className="px-4 rounded-lg bg-primary-container text-on-primary font-semibold disabled:opacity-50"
              >
                {loading ? '…' : 'Find'}
              </button>
            </div>

            {nfcSupported() && (
              <button
                onClick={onScan}
                disabled={scanning}
                className="w-full h-12 rounded-full border border-primary-container/40 text-primary-container font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Icon name="contactless" />
                {scanning ? 'Tap your card…' : 'Tap NFC claim card'}
              </button>
            )}

            {found && (
              <section className="bg-surface-container-lowest rounded-2xl p-6 card-shadow border border-outline-variant/30 flex flex-col items-center text-center gap-3">
                <StatusLight status={found.status} />
                <h3 className="text-xl font-semibold">{statusText(found.status)}</h3>
                <div className="text-on-surface-variant">
                  Your share: <span className="font-bold text-on-surface">{found.sharePct}%</span>
                  {' · ≈ '}
                  <span className="font-bold text-on-surface">
                    {found.estimateXlm.toLocaleString()} XLM
                  </span>
                </div>

                {found.claimed ? (
                  <p className="text-on-surface-variant text-sm">
                    You have already claimed your share.
                  </p>
                ) : unlocked ? (
                  <button
                    onClick={onClaim}
                    disabled={claiming}
                    className="w-full h-14 rounded-full bg-primary-container text-on-primary font-semibold uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition disabled:opacity-60 mt-2"
                  >
                    {claiming ? 'Claiming…' : 'Claim My Share'}
                    {!claiming && <Icon name="volunteer_activism" />}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-on-surface-variant text-sm bg-surface-container-low rounded-lg px-4 py-3 mt-1">
                    <Icon name="lock" className="text-base" />
                    Protected — the owner is still active.
                  </div>
                )}
              </section>
            )}

            {error && <p className="text-error text-sm break-words">{error}</p>}
          </>
        )}
      </div>
    </Layout>
  )
}
