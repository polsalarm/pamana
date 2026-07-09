import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { useActivity } from '../lib/hooks/useActivity'

const DIR_TONE = {
  in: 'bg-primary-container/10 text-primary-container',
  out: 'bg-surface-variant text-on-surface-variant',
  neutral: 'bg-secondary-container/15 text-secondary',
} as const

/** On-chain activity for the connected wallet. `limit` caps rows; `viewAll`
 *  shows a "View all" link to the full Activity page. */
export function ActivityLog({
  address,
  limit = 8,
  viewAll = false,
}: {
  address: string
  limit?: number
  viewAll?: boolean
}) {
  const { items, loading, error } = useActivity(address, limit)
  const navigate = useNavigate()

  return (
    <section className="flex flex-col gap-3">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-lg font-semibold">Activity</h3>
        {viewAll && items.length > 0 && (
          <button
            onClick={() => navigate('/activity')}
            className="text-primary-container text-sm font-semibold flex items-center gap-1"
          >
            View all <Icon name="arrow_forward" className="text-base" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-on-surface-variant py-3 justify-center">
          <Icon name="progress_activity" className="animate-spin text-base" />
          <span className="text-sm">Loading activity…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-surface-container-low rounded-xl p-5 text-center text-on-surface-variant text-sm">
          {error ? 'Could not load activity.' : 'No activity yet.'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="bg-surface-container-lowest rounded-xl p-3 flex items-center gap-3 card-shadow border border-outline-variant/20"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${DIR_TONE[it.dir]}`}
              >
                <Icon name={it.icon} className="text-base" />
              </div>
              <div className="flex-grow min-w-0">
                <div className="text-sm font-medium truncate capitalize">{it.label}</div>
                {it.sub && (
                  <div className="text-xs text-on-surface-variant">{it.sub}</div>
                )}
              </div>
              <span className="text-xs text-on-surface-variant flex-shrink-0">
                {it.when}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
