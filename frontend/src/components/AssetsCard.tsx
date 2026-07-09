import { Icon } from './Icon'
import { useWalletBalances } from '../lib/hooks/useWalletBalances'

/** "My Assets" — the connected wallet's real balances (what you hold now,
 *  including anything just claimed from a vault). */
export function AssetsCard({ address }: { address: string }) {
  const { balances, loading, error } = useWalletBalances(address)

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-6 card-shadow border border-outline-variant/30">
      <span className="text-xs uppercase tracking-wider text-on-surface-variant">
        My Assets
      </span>

      <div className="mt-3 flex flex-col gap-2">
        {loading ? (
          <div className="flex items-center gap-2 text-on-surface-variant py-2">
            <Icon name="progress_activity" className="animate-spin text-base" />
            <span className="text-sm">Loading balances…</span>
          </div>
        ) : balances.length === 0 ? (
          <p className="text-on-surface-variant text-sm py-1">
            {error
              ? 'Could not load balances.'
              : 'No assets in this wallet yet. Claimed funds will appear here.'}
          </p>
        ) : (
          balances.map((b) => (
            <div
              key={`${b.code}-${b.issuer ?? 'native'}`}
              className="flex items-baseline justify-between"
            >
              <span className="text-3xl font-bold">
                {b.amount.toLocaleString(undefined, { maximumFractionDigits: 7 })}
              </span>
              <span className="text-on-surface-variant font-medium">{b.code}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
