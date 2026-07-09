import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'

/** Stub for routes shipping in later phases (nft, activity, settings…). */
export function Placeholder({
  title,
  phase,
  icon = 'construction',
}: {
  title: string
  phase: string
  icon?: string
}) {
  return (
    <Layout>
      <div className="flex flex-col items-center text-center py-20 gap-3 text-on-surface-variant">
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
          <Icon name={icon} className="text-3xl" />
        </div>
        <h2 className="text-xl font-semibold text-on-surface">{title}</h2>
        <p className="text-sm">Coming in {phase}.</p>
      </div>
    </Layout>
  )
}
