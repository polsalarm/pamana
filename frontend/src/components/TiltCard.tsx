import {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
  type CSSProperties,
} from 'react'
import './TiltCard.css'

const ANIMATION_CONFIG = {
  INITIAL_DURATION: 1200,
  INITIAL_X_OFFSET: 70,
  INITIAL_Y_OFFSET: 60,
  DEVICE_BETA_OFFSET: 20,
  ENTER_TRANSITION_MS: 180,
}

const clamp = (v: number, min = 0, max = 100) => Math.min(Math.max(v, min), max)
const round = (v: number, precision = 3) => parseFloat(v.toFixed(precision))
const adjust = (v: number, fMin: number, fMax: number, tMin: number, tMax: number) =>
  round(tMin + ((tMax - tMin) * (v - fMin)) / (fMax - fMin))

interface TiltCardProps {
  children: ReactNode
  /** Classes on the tilting card element (e.g. background + text color). */
  cardClassName?: string
  /** Classes on the outer wrapper (e.g. aspect ratio / sizing). */
  className?: string
  enableTilt?: boolean
  enableMobileTilt?: boolean
  mobileTiltSensitivity?: number
  /** Optional icon pattern that masks the holographic shine. */
  iconUrl?: string
  shine?: boolean
  behindGlowEnabled?: boolean
  behindGlowColor?: string
  behindGlowSize?: string
  radius?: string
}

/** A card wrapper that adds a pointer-driven 3D tilt, holographic sheen, glare,
 *  and a cursor-following glow. Adapted from React Bits' ProfileCard effect. */
export function TiltCard({
  children,
  cardClassName = '',
  className = '',
  enableTilt = true,
  enableMobileTilt = false,
  mobileTiltSensitivity = 5,
  iconUrl,
  shine = true,
  behindGlowEnabled = true,
  behindGlowColor,
  behindGlowSize,
  radius,
}: TiltCardProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const enterTimerRef = useRef<number | null>(null)
  const leaveRafRef = useRef<number | null>(null)

  const tiltEngine = useMemo(() => {
    if (!enableTilt) return null

    let rafId: number | null = null
    let running = false
    let lastTs = 0
    let currentX = 0
    let currentY = 0
    let targetX = 0
    let targetY = 0

    const DEFAULT_TAU = 0.14
    const INITIAL_TAU = 0.6
    let initialUntil = 0

    const setVarsFromXY = (x: number, y: number) => {
      const shell = shellRef.current
      const wrap = wrapRef.current
      if (!shell || !wrap) return

      const width = shell.clientWidth || 1
      const height = shell.clientHeight || 1
      const percentX = clamp((100 / width) * x)
      const percentY = clamp((100 / height) * y)
      const centerX = percentX - 50
      const centerY = percentY - 50

      const properties: Record<string, string> = {
        '--pointer-x': `${percentX}%`,
        '--pointer-y': `${percentY}%`,
        '--background-x': `${adjust(percentX, 0, 100, 35, 65)}%`,
        '--background-y': `${adjust(percentY, 0, 100, 35, 65)}%`,
        '--pointer-from-center': `${clamp(Math.hypot(percentY - 50, percentX - 50) / 50, 0, 1)}`,
        '--pointer-from-top': `${percentY / 100}`,
        '--pointer-from-left': `${percentX / 100}`,
        '--rotate-x': `${round(-(centerX / 5))}deg`,
        '--rotate-y': `${round(centerY / 4)}deg`,
      }
      for (const [k, v] of Object.entries(properties)) wrap.style.setProperty(k, v)
    }

    const step = (ts: number) => {
      if (!running) return
      if (lastTs === 0) lastTs = ts
      const dt = (ts - lastTs) / 1000
      lastTs = ts

      const tau = ts < initialUntil ? INITIAL_TAU : DEFAULT_TAU
      const k = 1 - Math.exp(-dt / tau)
      currentX += (targetX - currentX) * k
      currentY += (targetY - currentY) * k
      setVarsFromXY(currentX, currentY)

      const stillFar =
        Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05
      if (stillFar || document.hasFocus()) {
        rafId = requestAnimationFrame(step)
      } else {
        running = false
        lastTs = 0
        if (rafId) {
          cancelAnimationFrame(rafId)
          rafId = null
        }
      }
    }

    const start = () => {
      if (running) return
      running = true
      lastTs = 0
      rafId = requestAnimationFrame(step)
    }

    return {
      setImmediate(x: number, y: number) {
        currentX = x
        currentY = y
        setVarsFromXY(currentX, currentY)
      },
      setTarget(x: number, y: number) {
        targetX = x
        targetY = y
        start()
      },
      toCenter() {
        const shell = shellRef.current
        if (!shell) return
        this.setTarget(shell.clientWidth / 2, shell.clientHeight / 2)
      },
      beginInitial(durationMs: number) {
        initialUntil = performance.now() + durationMs
        start()
      },
      getCurrent() {
        return { x: currentX, y: currentY, tx: targetX, ty: targetY }
      },
      cancel() {
        if (rafId) cancelAnimationFrame(rafId)
        rafId = null
        running = false
        lastTs = 0
      },
    }
  }, [enableTilt])

  const getOffsets = (evt: PointerEvent, el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top }
  }

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const shell = shellRef.current
      if (!shell || !tiltEngine) return
      const { x, y } = getOffsets(event, shell)
      tiltEngine.setTarget(x, y)
    },
    [tiltEngine],
  )

  const handlePointerEnter = useCallback(
    (event: PointerEvent) => {
      const shell = shellRef.current
      const wrap = wrapRef.current
      if (!shell || !wrap || !tiltEngine) return

      wrap.classList.add('active', 'entering')
      if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current)
      enterTimerRef.current = window.setTimeout(() => {
        wrap.classList.remove('entering')
      }, ANIMATION_CONFIG.ENTER_TRANSITION_MS)

      const { x, y } = getOffsets(event, shell)
      tiltEngine.setTarget(x, y)
    },
    [tiltEngine],
  )

  const handlePointerLeave = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap || !tiltEngine) return

    tiltEngine.toCenter()
    const checkSettle = () => {
      const { x, y, tx, ty } = tiltEngine.getCurrent()
      const settled = Math.hypot(tx - x, ty - y) < 0.6
      if (settled) {
        wrap.classList.remove('active')
        leaveRafRef.current = null
      } else {
        leaveRafRef.current = requestAnimationFrame(checkSettle)
      }
    }
    if (leaveRafRef.current) cancelAnimationFrame(leaveRafRef.current)
    leaveRafRef.current = requestAnimationFrame(checkSettle)
  }, [tiltEngine])

  const handleDeviceOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      const shell = shellRef.current
      if (!shell || !tiltEngine) return
      const { beta, gamma } = event
      if (beta == null || gamma == null) return

      const centerX = shell.clientWidth / 2
      const centerY = shell.clientHeight / 2
      const x = clamp(centerX + gamma * mobileTiltSensitivity, 0, shell.clientWidth)
      const y = clamp(
        centerY + (beta - ANIMATION_CONFIG.DEVICE_BETA_OFFSET) * mobileTiltSensitivity,
        0,
        shell.clientHeight,
      )
      tiltEngine.setTarget(x, y)
    },
    [tiltEngine, mobileTiltSensitivity],
  )

  useEffect(() => {
    if (!enableTilt || !tiltEngine) return
    const shell = shellRef.current
    if (!shell) return

    shell.addEventListener('pointerenter', handlePointerEnter)
    shell.addEventListener('pointermove', handlePointerMove)
    shell.addEventListener('pointerleave', handlePointerLeave)

    const handleClick = () => {
      if (!enableMobileTilt || location.protocol !== 'https:') return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyMotion = window.DeviceMotionEvent as any
      if (anyMotion && typeof anyMotion.requestPermission === 'function') {
        anyMotion
          .requestPermission()
          .then((state: string) => {
            if (state === 'granted') {
              window.addEventListener('deviceorientation', handleDeviceOrientation)
            }
          })
          .catch(console.error)
      } else {
        window.addEventListener('deviceorientation', handleDeviceOrientation)
      }
    }
    shell.addEventListener('click', handleClick)

    const initialX = (shell.clientWidth || 0) - ANIMATION_CONFIG.INITIAL_X_OFFSET
    const initialY = ANIMATION_CONFIG.INITIAL_Y_OFFSET
    tiltEngine.setImmediate(initialX, initialY)
    tiltEngine.toCenter()
    tiltEngine.beginInitial(ANIMATION_CONFIG.INITIAL_DURATION)

    return () => {
      shell.removeEventListener('pointerenter', handlePointerEnter)
      shell.removeEventListener('pointermove', handlePointerMove)
      shell.removeEventListener('pointerleave', handlePointerLeave)
      shell.removeEventListener('click', handleClick)
      window.removeEventListener('deviceorientation', handleDeviceOrientation)
      if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current)
      if (leaveRafRef.current) cancelAnimationFrame(leaveRafRef.current)
      tiltEngine.cancel()
      wrapRef.current?.classList.remove('entering')
    }
  }, [
    enableTilt,
    enableMobileTilt,
    tiltEngine,
    handlePointerMove,
    handlePointerEnter,
    handlePointerLeave,
    handleDeviceOrientation,
  ])

  const style = useMemo(() => {
    const v: Record<string, string> = {
      '--icon': iconUrl ? `url(${iconUrl})` : 'none',
      '--behind-glow-color': behindGlowColor ?? 'rgba(125, 190, 255, 0.67)',
      '--behind-glow-size': behindGlowSize ?? '50%',
    }
    if (radius) v['--card-radius'] = radius
    return v as unknown as CSSProperties
  }, [iconUrl, behindGlowColor, behindGlowSize, radius])

  return (
    <div ref={wrapRef} className={`tc-card-wrapper ${className}`.trim()} style={style}>
      {behindGlowEnabled && <div className="tc-behind" />}
      <div ref={shellRef} className="tc-card-shell">
        <div className={`tc-card ${cardClassName}`.trim()}>
          {shine && <div className="tc-shine" />}
          <div className="tc-glare" />
          <div className="tc-content">{children}</div>
        </div>
      </div>
    </div>
  )
}
