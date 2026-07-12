import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Icon } from '../../components/Icon'
import { StatusLight, statusText } from '../../components/StatusLight'
import { useWallet } from '../../contexts/WalletContext'
import { useFeedback } from '../../contexts/FeedbackContext'
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
import { DEMO_OWNER, demoCaptureEnabled, demoClaimData } from '../../lib/devDemo'
import {
  readTokenMeta,
  hasTrustline,
  addTrustline,
  getBalance,
  type SacAsset,
} from '../../lib/token'
import {
  enablePushReminders,
  pushEnabled,
  pushSupported,
  notify,
  notifyOnce,
} from '../../lib/push'
import { requestKyc } from '../../lib/kyc'
import { requestRedemption } from '../../lib/redeem'

const isStellarAddr = (a: string) => /^G[A-Z2-7]{55}$/.test(a.trim())

interface TokenClaim {
  sac: string
  symbol: string
  estimate: number
  claimed: boolean
  asset: SacAsset
  trusted: boolean
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
  const { runTx, toast } = useFeedback()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [owner, setOwner] = useState(() => (demoCaptureEnabled() ? DEMO_OWNER : ''))
  const [loading, setLoading] = useState(false)
  const [found, setFound] = useState<Found | null>(() =>
    demoCaptureEnabled() ? demoClaimData : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [claimingSac, setClaimingSac] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  /** SACs whose (demo) KYC approval has come back approved this session. */
  const [kycDone, setKycDone] = useState<Set<string>>(new Set())
  const [kycSac, setKycSac] = useState<string | null>(null)

  useEffect(() => {
    pushEnabled().then(setPushOn)
  }, [])

  async function onEnableAlerts() {
    if (!address) return
    setPushBusy(true)
    try {
      await enablePushReminders(address)
      setPushOn(true)
      toast('Claim alerts enabled', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not enable alerts', 'error')
    } finally {
      setPushBusy(false)
    }
  }

  const lookup = useCallback(
    async (ownerArg?: string) => {
      if (demoCaptureEnabled()) {
        setFound(demoClaimData)
        setError(null)
        return
      }
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
            const [bal, claimed, meta] = await Promise.all([
              getVaultBalance(sac, vaultId, address),
              isClaimed(vaultId, sac, address, address),
              readTokenMeta(sac, address).catch(() => null),
            ])
            const info = tokenBySac(sac)
            const asset: SacAsset = meta?.asset ?? { native: true }
            const decimals = meta?.decimals ?? info.decimals
            const trusted = await hasTrustline(address, asset)
            return {
              sac,
              symbol: meta?.symbol ?? info.symbol,
              estimate: (Number(bal) / 10 ** decimals) * (me.bps / 10000),
              claimed,
              asset,
              trusted,
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

  // Silent status re-check while a vault is found and still active — lets a
  // subscribed heir get notified the moment it unlocks without re-clicking
  // Find. Stops once unlocked; no need to keep polling after that.
  useEffect(() => {
    if (!address || !found || found.status !== 'Alive') return
    const id = setInterval(async () => {
      try {
        const status = await getStatus(found.vaultId, address)
        setFound((f) => (f ? { ...f, status } : f))
      } catch {
        // transient RPC hiccup — next tick retries
      }
    }, 8_000)
    return () => clearInterval(id)
  }, [address, found?.vaultId, found?.status])

  const unlocked = found && (found.status === 'TimedOut' || found.status === 'Distributing')

  useEffect(() => {
    if (!pushOn || !address || !found || !unlocked) return
    notifyOnce(`${found.vaultId}:claimable:${address}`, () =>
      notify(
        address,
        'You can now claim',
        `The vault naming you an heir (${found.sharePct}% share) is now claimable.`,
      ),
    )
  }, [pushOn, address, found, unlocked])

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

  async function onClaim(t: TokenClaim) {
    if (!address || !found) return
    setClaimingSac(t.sac)
    const { ok } = await runTx({
      confirm: {
        title: 'Claim your share',
        description: (
          <>
            <span className="font-semibold text-on-surface">
              {t.estimate.toLocaleString()} {t.symbol}
            </span>{' '}
            will be transferred to your wallet. This can only be done once.
          </>
        ),
        confirmLabel: 'Claim',
      },
      pendingTitle: 'Claiming your inheritance…',
      successTitle: 'Inheritance claimed',
      successDescription: `Your ${t.symbol} is now in your wallet.`,
      actionLabel: 'View my wallet',
      onAction: () => navigate('/dashboard'),
      action: () => claim(found.vaultId, t.sac, address, address),
    })
    setClaimingSac(null)
    if (ok) {
      notify(
        owner.trim(),
        'Heir claimed your vault',
        `${t.estimate.toLocaleString()} ${t.symbol} was claimed from your vault.`,
      )
      await lookup(owner) // refresh claimed state
    }
  }

  /** Compliance gate for an AUTH_REQUIRED title. The heir's trustline exists but
   *  is unauthorized, so a claim would trap on-chain until the issuer authorizes
   *  it. `deny` runs the simulated-rejection path to show the blocked state.
   *
   *  DEMO: the approver auto-approves — it stands in for a licensed compliance
   *  officer / custodian admin review, and checks no real identity. The on-chain
   *  gate it opens is real. See docs/RWA_PHASES.md. */
  async function onKyc(t: TokenClaim, deny = false) {
    if (!address) return
    setKycSac(t.sac)
    try {
      const res = await requestKyc(address, deny)
      if (res.approved) {
        setKycDone((s) => new Set(s).add(t.sac))
        toast(`Compliance approved — you can now claim ${t.symbol}`, 'success')
        await lookup(owner)
      } else {
        toast(res.reason ?? res.error ?? 'Compliance check declined', 'error')
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Compliance check failed', 'error')
    } finally {
      setKycSac(null)
    }
  }

  async function onTrust(t: TokenClaim) {
    if (!address) return
    setClaimingSac(t.sac)
    const { ok } = await runTx({
      confirm: {
        title: `Add ${t.symbol} trustline`,
        description: `Your wallet needs a trustline before it can hold ${t.symbol}. This is a one-time setup.`,
        confirmLabel: 'Add trustline',
      },
      pendingTitle: 'Adding trustline…',
      successTitle: 'Trustline added',
      successDescription: `You can now claim your ${t.symbol}.`,
      action: () => addTrustline(address, t.asset),
    })
    setClaimingSac(null)
    if (ok) await lookup(owner) // refresh trusted state
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
            className="flex-grow bg-surface-container-low rounded-xl px-3 py-3 text-sm outline-none"
          />
          <button
            onClick={() => lookup()}
            disabled={!isStellarAddr(owner) || loading}
            className="px-4 rounded-xl bg-primary-container text-on-primary font-semibold disabled:opacity-50"
          >
            {loading ? '…' : 'Find'}
          </button>
        </div>

        {nfcSupported() && (
          <button
            onClick={onScan}
            disabled={scanning}
            className="w-full h-12 rounded-xl border border-primary-container/40 text-primary-container font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
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

            {!unlocked && pushSupported() && !pushOn && (
              <button
                onClick={onEnableAlerts}
                disabled={pushBusy}
                className="text-sm text-primary-container font-medium flex items-center gap-1.5 disabled:opacity-50"
              >
                <Icon name="notifications" className="text-base" />
                {pushBusy ? 'Enabling…' : 'Alert me when I can claim'}
              </button>
            )}

            {!unlocked ? (
              <div className="flex items-center gap-2 text-on-surface-variant text-sm bg-surface-container-low rounded-lg px-4 py-3 mt-1">
                <Icon name="lock" className="text-base" />
                Protected — the owner is still active.
              </div>
            ) : found.tokens.length === 0 ? (
              <p className="text-on-surface-variant text-sm">This vault holds no tokens.</p>
            ) : (
              <div className="w-full flex flex-col gap-2 mt-1">
                {found.tokens.map((t) => {
                  const gated = tokenBySac(t.sac).rwa?.gated === true
                  const needsKyc = gated && !kycDone.has(t.sac)
                  return (
                    <div
                      key={t.sac}
                      className="flex flex-col gap-2 bg-surface-container-low rounded-xl px-4 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <div className="font-semibold flex items-center gap-1.5">
                            {t.estimate.toLocaleString()} {t.symbol}
                            {gated && (
                              <span className="text-[10px] uppercase tracking-wider font-semibold text-secondary-container bg-secondary-container/10 rounded-full px-2 py-0.5">
                                KYC
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-on-surface-variant">your share</div>
                        </div>
                        {t.claimed ? (
                          <span className="text-xs text-on-surface-variant flex items-center gap-1">
                            <Icon name="check" className="text-base" /> Claimed
                          </span>
                        ) : !t.trusted ? (
                          <button
                            onClick={() => onTrust(t)}
                            disabled={claimingSac !== null}
                            className="h-11 px-4 rounded-xl border border-primary-container/50 text-primary-container font-semibold text-sm disabled:opacity-60 flex items-center gap-1"
                            title="Add a trustline so your wallet can hold this asset"
                          >
                            {claimingSac === t.sac ? 'Adding…' : 'Add trustline'}
                          </button>
                        ) : needsKyc ? (
                          <button
                            onClick={() => onKyc(t)}
                            disabled={kycSac !== null}
                            className="h-11 px-4 rounded-xl border border-secondary-container/50 text-secondary-container font-semibold text-sm disabled:opacity-60"
                            title="This title requires compliance approval before it can be claimed"
                          >
                            {kycSac === t.sac ? 'Checking…' : 'Complete KYC'}
                          </button>
                        ) : (
                          <button
                            onClick={() => onClaim(t)}
                            disabled={claimingSac !== null}
                            className="h-11 px-4 rounded-xl bg-primary-container text-on-primary font-semibold text-sm disabled:opacity-60"
                          >
                            {claimingSac === t.sac ? 'Claiming…' : 'Claim'}
                          </button>
                        )}
                      </div>

                      {/* Compliance gate — real on-chain (AUTH_REQUIRED); the
                          approval DECISION is simulated for the demo. */}
                      {!t.claimed && t.trusted && needsKyc && (
                        <div className="text-left text-xs text-on-surface-variant border-t border-outline-variant/30 pt-2">
                          <div className="flex items-start gap-1.5">
                            <Icon name="lock" className="text-sm mt-0.5" />
                            <span>
                              Regulated title — your trustline is <b>not yet authorized</b>,
                              so a claim would be rejected on-chain until the issuer
                              approves it.
                            </span>
                          </div>
                          <div className="mt-1.5 italic">
                            Demo: approval is simulated — a licensed compliance operator
                            plugs in here. No identity data is collected.{' '}
                            <button
                              onClick={() => onKyc(t, true)}
                              disabled={kycSac !== null}
                              className="underline disabled:opacity-60 not-italic"
                            >
                              Simulate rejection
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Redemption (Phase 4) — real clawback burn once the
                          (simulated) custodian confirms the title transfer. */}
                      {t.claimed && tokenBySac(t.sac).rwa && (
                        <RedeemGate sac={t.sac} symbol={t.symbol} asset={t.asset} address={address ?? ''} />
                      )}
                    </div>
                  )
                })}
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

/** Post-claim redemption gate (Phase 4). Reads the heir's real on-chain
 *  balance rather than session state — once the (simulated) custodian's
 *  clawback lands, the balance genuinely drops to 0, so "Redeemed" reflects
 *  what's actually on-chain, not a flag we made up client-side. */
function RedeemGate({
  sac,
  symbol,
  asset,
  address,
}: {
  sac: string
  symbol: string
  asset: SacAsset
  address: string
}) {
  const { toast } = useFeedback()
  const [balance, setBalance] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    if (!address) return
    getBalance(address, asset).then(setBalance).catch(() => setBalance(null))
  }, [address, asset])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function onRedeem(deny = false) {
    setBusy(true)
    try {
      const res = await requestRedemption(address, sac, deny)
      if (res.approved) {
        toast(`Redemption approved — ${symbol} clawed back for the title transfer`, 'success')
        refresh()
      } else {
        toast(res.reason ?? res.error ?? 'Redemption declined', 'error')
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Redemption failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (balance === null) return null // still loading

  if (balance <= 0) {
    return (
      <div className="text-left text-xs text-on-surface-variant border-t border-outline-variant/30 pt-2 flex items-center gap-1.5">
        <Icon name="check_circle" className="text-sm" />
        Redeemed — token clawed back; title transfer handled by the custodian
        (demo: simulated).
      </div>
    )
  }

  return (
    <div className="text-left text-xs text-on-surface-variant border-t border-outline-variant/30 pt-2">
      <div className="flex items-center justify-between gap-2">
        <span>Ready to redeem for the real title.</span>
        <button
          onClick={() => onRedeem()}
          disabled={busy}
          className="h-8 px-3 rounded-lg border border-primary-container/50 text-primary-container font-semibold text-xs disabled:opacity-60 shrink-0"
        >
          {busy ? 'Redeeming…' : 'Redeem for title'}
        </button>
      </div>
      <div className="mt-1.5 italic">
        Demo: custodian review is simulated — a licensed custodian/SPV plugs in
        here and only claws back once the real transfer is confirmed.{' '}
        <button
          onClick={() => onRedeem(true)}
          disabled={busy}
          className="underline disabled:opacity-60 not-italic"
        >
          Simulate hold
        </button>
      </div>
    </div>
  )
}
