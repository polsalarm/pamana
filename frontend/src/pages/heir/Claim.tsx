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
  getTokens,
  getVaultBalance,
  isClaimed,
  claim,
  type VaultStatus,
} from '../../lib/contract'
import { tokenBySac } from '../../lib/config'

const isStellarAddr = (a: string) => /^G[A-Z2-7]{55}$/.test(a.trim())

interface TokenClaim {
  sac: string
  symbol: string
  estimate: number
  claimed: boolean
}

interface Found {
  vaultId: string
  status: VaultStatus
  sharePct: number
  bps: number
  tokens: TokenClaim[]
}

export function Claim() {
  const { address } = useWallet()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [owner, setOwner] = useState('')
  const [loading, setLoading] = useState(false)
  const [found, setFound] = useState<Found | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [claimingSac, setClaimingSac] = useState<string | null>(null)
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
        const [status, heirs, tokenList] = await Promise.all([
          getStatus(vaultId, address),
          getHeirs(vaultId, address),
          getTokens(vaultId, address),
        ])
        const me = heirs.find((h) => h.addr === address)
        if (!me) {
          setError('Your wallet is not listed as an heir of this vault.')
          return
        }
        const tokens: TokenClaim[] = await Promise.all(
          (tokenList ?? []).map(async (sac) => {
            const [bal, claimed] = await Promise.all([
              getVaultBalance(sac, vaultId, address),
              isClaimed(vaultId, sac, address, address),
            ])
            const info = tokenBySac(sac)
            return {
              sac,
              symbol: info.symbol,
              estimate:
                (Number(bal) / 10 ** info.decimals) * (me.bps / 10000),
              claimed,
            }
          }),
        )
        setFound({ vaultId, status, sharePct: me.bps / 100, bps: me.bps, tokens })
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

  async function onClaim(sac: string) {
    if (!address || !found) return
    setClaimingSac(sac)
    setError(null)
    try {
      await claim(found.vaultId, sac, address, address)
      await lookup(owner) // refresh claimed state
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setClaimingSac(null)
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
            <div className="text-on-surface-variant text-sm">
              Your share: <span className="font-bold text-on-surface">{found.sharePct}%</span>
            </div>

            {!unlocked ? (
              <div className="flex items-center gap-2 text-on-surface-variant text-sm bg-surface-container-low rounded-lg px-4 py-3 mt-1">
                <Icon name="lock" className="text-base" />
                Protected — the owner is still active.
              </div>
            ) : found.tokens.length === 0 ? (
              <p className="text-on-surface-variant text-sm">This vault holds no tokens.</p>
            ) : (
              <div className="w-full flex flex-col gap-2 mt-1">
                {found.tokens.map((t) => (
                  <div
                    key={t.sac}
                    className="flex items-center justify-between bg-surface-container-low rounded-xl px-4 py-3"
                  >
                    <div className="text-left">
                      <div className="font-semibold">
                        {t.estimate.toLocaleString()} {t.symbol}
                      </div>
                      <div className="text-xs text-on-surface-variant">your share</div>
                    </div>
                    {t.claimed ? (
                      <span className="text-xs text-on-surface-variant flex items-center gap-1">
                        <Icon name="check" className="text-base" /> Claimed
                      </span>
                    ) : (
                      <button
                        onClick={() => onClaim(t.sac)}
                        disabled={claimingSac !== null}
                        className="h-10 px-4 rounded-full bg-primary-container text-on-primary font-semibold text-sm disabled:opacity-60"
                      >
                        {claimingSac === t.sac ? 'Claiming…' : 'Claim'}
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => navigate('/offramp')}
                  className="mt-2 text-primary-container font-semibold text-sm flex items-center justify-center gap-1"
                >
                  Cash out to pesos <Icon name="payments" className="text-base" />
                </button>
              </div>
            )}
          </section>
        )}

        {error && <p className="text-error text-sm break-words">{error}</p>}
      </div>
    </Layout>
  )
}
