import type { VaultStatus } from '../lib/contract'

/** The brand's heartbeat motif — glowing ring around a status dot.
 *  Green = Alive, amber = TimedOut / Distributing (inheritance unlocked). */
export function StatusLight({
  status,
  label,
}: {
  status: VaultStatus | null
  label?: string
}) {
  const unlocked = status === 'TimedOut' || status === 'Distributing'
  const ringColor = unlocked ? 'border-secondary-container/40' : 'border-primary-container/40'
  const dotColor = unlocked ? 'bg-secondary-container' : 'bg-primary-container'
  const glow = unlocked ? 'status-glow-amber' : 'status-glow'

  return (
    <div className="flex flex-col items-center">
      <div className={`w-24 h-24 rounded-full border-4 ${ringColor.replace('/40', '/20')} flex items-center justify-center`}>
        <div className={`w-20 h-20 rounded-full border-4 ${ringColor} flex items-center justify-center`}>
          <div className={`w-14 h-14 rounded-full ${dotColor} ${glow} flex items-center justify-center`}>
            {label && (
              <span className="text-lg font-semibold text-on-primary">{label}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function statusText(status: VaultStatus | null): string {
  switch (status) {
    case 'Alive':
      return 'Alive'
    case 'TimedOut':
      return 'Inheritance Unlocked'
    case 'Distributing':
      return 'Distributing'
    default:
      return '—'
  }
}
