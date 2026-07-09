import { Icon } from './Icon'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

const ICON: Record<ToastKind, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
}

const TONE: Record<ToastKind, string> = {
  success: 'text-primary-container',
  error: 'text-error',
  info: 'text-on-surface-variant',
}

/** Bottom-anchored transient toast stack (sits above the nav bar). */
export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed inset-x-0 bottom-[96px] z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2 max-w-[360px] w-full bg-inverse-surface text-surface rounded-xl px-4 py-3 card-shadow animate-[slideUp_200ms_ease-out]"
        >
          <Icon name={ICON[t.kind]} className={`text-base ${TONE[t.kind]}`} />
          <span className="text-sm">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
