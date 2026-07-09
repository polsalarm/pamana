import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { TiltCard } from '../components/TiltCard'
import { RwaCard, RoadmapBadge } from '../components/RoadmapCards'
import { useWallet } from '../contexts/WalletContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { nfcSupported, writeClaimCard, readClaimCard } from '../lib/nfc'
import { shortAddr } from '../lib/config'
import logo from '../assets/logo.svg'

type CardStatus = 'blank' | 'writing' | 'done'

const programmedKey = (addr: string) => `pamana.cardProgrammed.${addr}`

/** NFC tap-to-claim cards: program a blank tag with your address so a
 *  non-crypto heir can tap to claim. The card starts blank and "fills in" into
 *  the branded card once programmed. Web NFC is Android-Chrome only; a copyable
 *  link is the fallback (and desktop gets a labeled preview of the animation). */
export function Nfc() {
  const { address } = useWallet()
  const { toast } = useFeedback()
  const navigate = useNavigate()
  const supported = nfcSupported()

  const [status, setStatus] = useState<CardStatus>(() =>
    typeof localStorage !== 'undefined' &&
    address &&
    localStorage.getItem(programmedKey(address)) === '1'
      ? 'done'
      : 'blank',
  )
  const [reading, setReading] = useState(false)

  if (!address) return null
  const claimLink = `${window.location.origin}/claim?owner=${address}`

  async function program() {
    if (!supported) {
      // No Web NFC here — show the reveal as a labeled preview.
      setStatus('done')
      toast('Preview — program a real card on Android Chrome.', 'info')
      return
    }
    setStatus('writing')
    try {
      await writeClaimCard(address!)
      localStorage.setItem(programmedKey(address!), '1')
      setStatus('done')
      toast('Card programmed ✓', 'success')
    } catch (e) {
      setStatus('blank')
      toast(e instanceof Error ? e.message : 'Write failed — try again', 'error')
    }
  }

  function reprogram() {
    localStorage.removeItem(programmedKey(address!))
    setStatus('blank')
  }

  async function tapToClaim() {
    setReading(true)
    try {
      const owner = await readClaimCard()
      navigate(`/claim?owner=${owner}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not read the card', 'error')
    } finally {
      setReading(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(claimLink)
      toast('Claim link copied', 'success')
    } catch {
      toast('Could not copy link', 'error')
    }
  }

  return (
    <Layout>
      <div className="flex flex-col gap-5 pt-2">
        <div>
          <h2 className="text-2xl font-semibold">NFC claim card</h2>
          <p className="text-on-surface-variant mt-1">
            Bind your address to a tap card so an heir can claim with a tap — no
            seed phrase, no app hunting.
          </p>
        </div>

        {/* The card: blank → programming → revealed branded card */}
        {status === 'done' ? (
          <div className="animate-[cardReveal_700ms_cubic-bezier(0.2,0.8,0.2,1)_both]">
            <TiltCard
              cardClassName="w-full aspect-[1.586/1] bg-primary-container text-on-primary"
              className="w-full"
              radius="20px"
              behindGlowColor="rgba(16, 185, 129, 0.35)"
              behindGlowSize="60%"
            >
              <div className="relative h-full p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={logo} alt="" className="w-7 h-7" />
                    <span className="font-bold tracking-wide">Pamana</span>
                  </div>
                  <Icon name="contactless" className="text-3xl text-primary-fixed" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-primary-fixed-dim">
                    Tap to claim
                  </div>
                  <div className="font-mono text-lg mt-0.5">{shortAddr(address, 6)}</div>
                </div>
              </div>
            </TiltCard>
          </div>
        ) : (
          <button
            onClick={program}
            disabled={status === 'writing'}
            className="w-full aspect-[1.586/1] rounded-[20px] border-2 border-dashed border-outline-variant/60 bg-surface-container-low flex flex-col items-center justify-center gap-2 text-on-surface-variant hover:border-primary-container/50 transition disabled:cursor-default"
          >
            {status === 'writing' ? (
              <>
                <span className="relative flex items-center justify-center w-12 h-12">
                  <span className="absolute w-12 h-12 rounded-full bg-primary-container/20 status-glow" />
                  <Icon name="contactless" className="text-4xl text-primary-container" />
                </span>
                <span className="text-sm font-medium text-on-surface">Programming…</span>
                <span className="text-xs">Hold your card to the phone</span>
              </>
            ) : (
              <>
                <Icon name="contactless" className="text-4xl opacity-70" />
                <span className="text-sm font-medium">Blank card</span>
                <span className="text-xs">
                  {supported ? 'Tap to program' : 'Tap to preview'}
                </span>
              </>
            )}
          </button>
        )}

        {/* The blank card above is itself the tap target — only the revealed
            state needs a separate button to start over. */}
        {status === 'done' && (
          <button
            onClick={reprogram}
            className="w-full h-12 rounded-full border border-primary-container/40 text-primary-container font-semibold flex items-center justify-center gap-2"
          >
            <Icon name="refresh" />
            Program another card
          </button>
        )}

        {/* Tap someone else's card to claim */}
        {supported && (
          <button
            onClick={tapToClaim}
            disabled={reading}
            className="w-full h-12 rounded-full border border-outline-variant/50 text-on-surface font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Icon name="contactless" />
            {reading ? 'Tap the card…' : 'Tap a card to claim'}
          </button>
        )}

        {!supported && (
          <div className="bg-surface-container-low rounded-xl p-4 flex items-start gap-3 text-sm text-on-surface-variant">
            <Icon name="info" className="text-primary-container" />
            <p>
              Web NFC works on <strong>Android Chrome</strong>. On this device,
              share the claim link below — or open Pamana on an Android phone to
              program a real card.
            </p>
          </div>
        )}

        {/* Link fallback — works everywhere */}
        <section className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/30 flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wider text-on-surface-variant">
            Claim link
          </span>
          <div className="flex items-center gap-2">
            <code className="flex-grow text-xs bg-surface-container-low rounded-lg px-3 py-2 break-all">
              {claimLink}
            </code>
            <button
              onClick={copyLink}
              className="w-11 h-11 rounded-lg bg-primary-container/10 text-primary-container flex items-center justify-center flex-shrink-0"
              title="Copy claim link"
            >
              <Icon name="content_copy" />
            </button>
          </div>
        </section>

        {/* RWA vision */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-lg font-semibold">Also on the roadmap</h3>
            <RoadmapBadge />
          </div>
          <RwaCard />
        </section>
      </div>
    </Layout>
  )
}
