import { demoCaptureEnabled } from '../lib/devDemo'

const demoIcon: Record<string, string> = {
  account_balance: '▣',
  account_balance_wallet: '₱',
  add: '+',
  add_home: '+',
  arrow_back: '‹',
  arrow_downward: '↓',
  arrow_forward: '›',
  arrow_upward: '↑',
  check: '✓',
  check_circle: '✓',
  close: '×',
  contactless: 'NFC',
  dark_mode: '☾',
  light_mode: '☼',
  favorite: '♥',
  group_add: '+',
  history: '↺',
  home: '⌂',
  info: 'i',
  lock: '•',
  logout: '⏻',
  payments: '₱',
  person: '•',
  person_add: '+',
  progress_activity: '·',
  search: '?',
  shield: '◆',
  shield_person: '◆',
  south: '↓',
  wallet: '▣',
  verified_user: '✓',
}

/** Material Symbols icon. `fill` for the solid variant. */
export function Icon({
  name,
  className = '',
  fill = false,
}: {
  name: string
  className?: string
  fill?: boolean
}) {
  if (demoCaptureEnabled()) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center font-semibold leading-none ${className}`}
      >
        {demoIcon[name] ?? '•'}
      </span>
    )
  }

  return (
    <span className={`material-symbols-outlined ${fill ? 'fill' : ''} ${className}`}>
      {name}
    </span>
  )
}