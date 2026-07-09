import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { ActivityLog } from '../components/ActivityLog'
import { useWallet } from '../contexts/WalletContext'

/** Full on-chain activity history for the connected wallet. */
export function Activity() {
  const { address } = useWallet()
  const navigate = useNavigate()

  if (!address) return null

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
          <h2 className="text-2xl font-semibold">All activity</h2>
          <p className="text-on-surface-variant mt-1">
            Your on-chain history on Stellar Testnet.
          </p>
        </div>

        <ActivityLog address={address} limit={50} />
      </div>
    </Layout>
  )
}
