import { Icon } from './Icon'

/** Roadmap "Roadmap" label chip — keeps the vision cards honestly badged. */
export function RoadmapBadge() {
  return (
    <span className="text-[10px] uppercase tracking-wider bg-secondary-container/20 text-secondary px-2 py-0.5 rounded-full">
      Roadmap
    </span>
  )
}

/** Sentinel monitor — static "Protected" status light (roadmap). */
export function SentinelCard() {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-4 card-shadow border border-outline-variant/20 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10">
          <span className="w-3 h-3 rounded-full bg-primary-container status-glow" />
          <span className="absolute w-6 h-6 rounded-full border border-primary-container/30" />
        </div>
        <div>
          <div className="text-sm font-medium">Sentinel monitor</div>
          <div className="text-xs text-on-surface-variant">
            Protected · 24/7 anomaly watch
          </div>
        </div>
      </div>
      <Icon name="shield" className="text-primary-container" />
    </div>
  )
}

/** RWA asset card — mock real-world asset (roadmap). */
export function RwaCard() {
  return (
    <div className="rounded-2xl p-5 card-shadow overflow-hidden relative bg-primary-container text-on-primary">
      <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-primary-fixed-dim/20 blur-2xl" />
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-primary-fixed-dim">
            Real-world asset
          </span>
          <div className="text-xl font-bold mt-1">Family lot · Quezon City</div>
          <div className="text-primary-fixed-dim text-sm mt-0.5">
            ₱2,400,000 · tokenized title
          </div>
        </div>
        <Icon name="home_work" className="text-3xl text-primary-fixed" />
      </div>
      <p className="relative z-10 text-xs text-primary-fixed-dim mt-3">
        Inherit property and other real-world assets alongside crypto. Live on
        testnet with a signed valuation oracle; the legal + custody layer is the
        remaining roadmap.
      </p>
    </div>
  )
}

/** Roadmap stubs shown as vision (doc §4.7). Clearly labeled "Roadmap" so the
 *  demo is honest: these are the pitch's future, not shipped features. */
export function RoadmapCards() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <h3 className="text-lg font-semibold">Coming soon</h3>
        <RoadmapBadge />
      </div>
      <SentinelCard />
      <RwaCard />
    </section>
  )
}
