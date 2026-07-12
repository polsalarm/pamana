import { useState } from 'react'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { useWallet } from '../contexts/WalletContext'
import { useTheme } from '../contexts/ThemeContext'
import { useFeedback } from '../contexts/FeedbackContext'
import { shortAddr } from '../lib/config'

const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

export function Settings() {
  const { address, disconnect } = useWallet()
  const { theme, toggle } = useTheme()
  const { runTx, toast } = useFeedback()
  const [copied, setCopied] = useState(false)

  const claimPath = address ? `/claim?owner=${address}` : ''
  const claimLink = address ? `${window.location.origin}${claimPath}` : ''

  async function logout() {
    await runTx({
      confirm: {
        title: 'Log out?',
        description: "You'll need to reconnect your wallet to get back into your vault.",
        confirmLabel: 'Log out',
        tone: 'danger',
      },
      silentSuccess: true,
      action: async () => disconnect(),
    })
  }

  async function shareClaimLink() {
    if (canShare) {
      try {
        await navigator.share({ title: 'Bequest claim link', url: claimLink })
      } catch {
        /* user backed out of the share sheet — not an error */
      }
      return
    }
    try {
      await navigator.clipboard.writeText(claimLink)
      setCopied(true)
      toast('Claim link copied', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('Could not copy link', 'error')
    }
  }

  return (
    <Layout>
      <div className="flex flex-col gap-5 pt-2">
        <div>
          <h2 className="text-2xl font-semibold">Settings</h2>
          <p className="text-on-surface-variant mt-1">Manage your app preferences and session.</p>
        </div>

        {address && (
          <section className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/30 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center flex-shrink-0">
              <Icon name="account_balance_wallet" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-on-surface-variant">Connected wallet</div>
              <div className="font-mono text-sm truncate">{shortAddr(address, 6)}</div>
            </div>
          </section>
        )}

        {address && (
          <section className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/30 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center flex-shrink-0">
                <Icon name="link" />
              </div>
              <div className="min-w-0">
                <div className="font-medium">Claim link</div>
                <div className="text-xs text-on-surface-variant">
                  For an heir without a tap-capable phone
                </div>
              </div>
            </div>

            <div className="flex items-center bg-surface-container-low rounded-xl px-3 py-2.5 overflow-hidden">
              <span className="text-xs text-on-surface-variant truncate min-w-0">
                {window.location.origin}/claim?owner=
              </span>
              <span className="font-mono text-xs font-semibold shrink-0">
                {shortAddr(address, 6)}
              </span>
            </div>

            <button
              onClick={shareClaimLink}
              className="w-full h-11 rounded-xl bg-primary-container/10 text-primary-container font-semibold flex items-center justify-center gap-2"
            >
              <Icon name={copied ? 'check' : canShare ? 'ios_share' : 'content_copy'} className="text-lg" />
              {copied ? 'Copied' : canShare ? 'Share link' : 'Copy link'}
            </button>
          </section>
        )}

        <section className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center flex-shrink-0">
              <Icon name={theme === 'dark' ? 'dark_mode' : 'light_mode'} />
            </div>
            <div>
              <div className="font-medium">Dark mode</div>
              <div className="text-xs text-on-surface-variant">
                {theme === 'dark' ? 'On' : 'Off'} — matches your device by default
              </div>
            </div>
          </div>
          <button
            onClick={toggle}
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="Toggle dark mode"
            className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-colors ${
              theme === 'dark' ? 'bg-primary-container' : 'bg-outline-variant'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </section>

        <button
          onClick={logout}
          className="w-full h-14 rounded-xl border border-error/40 text-error font-semibold flex items-center justify-center gap-2"
        >
          <Icon name="logout" />
          Log out
        </button>
      </div>
    </Layout>
  )
}
