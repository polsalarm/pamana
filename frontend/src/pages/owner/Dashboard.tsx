import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { Icon } from '../../components/Icon'
import { RoadmapCards } from '../../components/RoadmapCards'
import { AssetsCard } from '../../components/AssetsCard'
import { ActivityLog } from '../../components/ActivityLog'
import { VaultPanel } from '../../components/VaultPanel'
import { useWallet } from '../../contexts/WalletContext'
import { useFeedback } from '../../contexts/FeedbackContext'

/** Home — what you hold, quick money actions, your vault (the core feature),
 *  recent activity, and the product vision. */
export function Dashboard() {
  const { address } = useWallet()
  const { toast } = useFeedback()
  const navigate = useNavigate()

  if (!address) return null

  return (
    <Layout>
      {/* My wallet assets — what you hold / just claimed. */}
      <AssetsCard address={address} />

      {/* Money actions: cash out, cash in, claim. */}
      <div className="grid grid-cols-3 gap-3">
        <ActionButton
          icon="payments"
          label="Cash out"
          onClick={() => navigate('/offramp')}
        />
        <ActionButton
          icon="account_balance"
          label="Cash in"
          badge="Soon"
          onClick={() => toast('PHP on-ramp (cash in) is on the roadmap — coming soon.', 'info')}
        />
        <ActionButton
          icon="redeem"
          label="Claim"
          tone="accent"
          onClick={() => navigate('/claim')}
        />
      </div>

      {/* The vault — Pamana's core feature. */}
      <VaultPanel />

      {/* Recent on-chain activity. */}
      <ActivityLog address={address} viewAll />

      {/* Product vision (roadmap). */}
      <RoadmapCards />
    </Layout>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  tone = 'primary',
  badge,
}: {
  icon: string
  label: string
  onClick: () => void
  tone?: 'primary' | 'accent'
  badge?: string
}) {
  const bg =
    tone === 'accent'
      ? 'bg-secondary-container/15 text-secondary'
      : 'bg-primary-container/10 text-primary-container'
  return (
    <button
      onClick={onClick}
      className="relative bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/20 flex flex-col items-center gap-2 hover:opacity-90 active:scale-[0.98] transition"
    >
      {badge && (
        <span className="absolute top-2 right-2 text-[9px] font-semibold uppercase tracking-wide text-secondary bg-secondary-container/20 rounded-full px-1.5 py-0.5">
          {badge}
        </span>
      )}
      <div className={`w-11 h-11 rounded-full flex items-center justify-center ${bg}`}>
        <Icon name={icon} />
      </div>
      <span className="text-sm font-medium text-on-surface">{label}</span>
    </button>
  )
}
