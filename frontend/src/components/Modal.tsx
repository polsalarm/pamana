import type { ReactNode } from 'react'
import { useEffect } from 'react'

/**
 * Overlay primitive: dimmed backdrop + centered card. Pins to the nearest
 * positioned ancestor — inside `DesktopFrame` that's the phone screen layer
 * (its `translateZ(0)` is the containing block), so modals stay in the frame.
 *
 * `dismissable` controls backdrop-click / Escape closing; pass `false` while a
 * transaction is in flight so the user can't dismiss a pending action.
 */
export function Modal({
  open,
  onClose,
  dismissable = true,
  children,
}: {
  open: boolean
  onClose: () => void
  dismissable?: boolean
  children: ReactNode
}) {
  useEffect(() => {
    if (!open || !dismissable) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismissable, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        onClick={dismissable ? onClose : undefined}
        className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[400px] mx-3 mb-3 sm:mb-0 bg-surface-container-lowest rounded-2xl card-shadow border border-outline-variant/30 p-6 animate-[slideUp_200ms_ease-out]"
      >
        {children}
      </div>
    </div>
  )
}
