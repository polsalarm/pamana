import type { ReactNode } from 'react'

/**
 * Wraps the whole app in a phone-shaped device mockup on desktop.
 *
 * - Phones (< lg): pure passthrough. App renders full-bleed, no frame.
 * - Desktop (>= lg): app sits inside a black-bezel device centered on a
 *   tinted backdrop, so a mobile-first UI doesn't sprawl across a wide window.
 *
 * On desktop the screen layer carries `translateZ(0)` so it becomes the
 * containing block for `position: fixed` descendants (bottom nav, floating
 * widgets, modals). Without it, those pin to the browser viewport and escape
 * the phone. Keep it — but only at `lg`: below that there is no frame, the
 * layer is as tall as the document, and a containing block there would drop
 * the bottom nav at the end of the page instead of pinning it to the viewport.
 */
export function DesktopFrame({ children }: { children: ReactNode }) {
  return (
    <div className="lg:flex lg:min-h-[100dvh] lg:items-center lg:justify-center lg:p-6 lg:bg-neutral-200/60 dark:lg:bg-neutral-950">
      {/* Device body */}
      <div className="lg:relative lg:w-[420px] lg:h-[calc(100dvh-3rem)] lg:max-h-[920px] lg:rounded-[3rem] lg:bg-neutral-900 lg:p-3 lg:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.55)] lg:ring-1 lg:ring-black/10">
        {/* Fake side buttons (desktop only) */}
        <span className="hidden lg:block absolute left-[-2px] top-[120px] h-16 w-[3px] rounded-l bg-neutral-800" />
        <span className="hidden lg:block absolute right-[-2px] top-[100px] h-10 w-[3px] rounded-r bg-neutral-800" />
        <span className="hidden lg:block absolute right-[-2px] top-[160px] h-10 w-[3px] rounded-r bg-neutral-800" />

        {/* Screen layer — containing block for fixed descendants on desktop only. */}
        <div className="lg:h-full lg:overflow-hidden lg:rounded-[2.25rem] lg:[transform:translateZ(0)]">
          {/* Inner scroll layer — scrollbars hidden globally in index.css */}
          <div className="lg:h-full lg:overflow-y-auto lg:overscroll-contain">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
