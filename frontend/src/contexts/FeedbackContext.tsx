import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Modal } from '../components/Modal'
import { Icon } from '../components/Icon'
import { ToastStack, type ToastItem, type ToastKind } from '../components/Toast'
import { consumeLastTxHash } from '../lib/stellar'
import { explorerTxUrl } from '../lib/config'

export interface RunTxOptions<T = unknown> {
  /** Confirmation step. Omit to skip straight to running the action. */
  confirm?: {
    title: string
    description?: ReactNode
    confirmLabel?: string
    tone?: 'default' | 'danger'
  }
  pendingTitle?: string
  pendingDescription?: ReactNode
  successTitle?: string
  successDescription?: ReactNode
  /** Extra reference row on the success screen (e.g. an off-ramp reference). */
  successDetail?: { label: string; value: string }
  /** Link the confirmed tx on a block explorer (default true). */
  showExplorer?: boolean
  /** Resolve immediately on success without showing the success modal — for
   *  callers that render their own success screen (e.g. the off-ramp receipt). */
  silentSuccess?: boolean
  /** Secondary success button, e.g. "View my wallet". */
  actionLabel?: string
  onAction?: () => void
  action: () => Promise<T>
}

export interface RunTxResult<T = unknown> {
  ok: boolean
  result?: T
  error?: Error
  cancelled?: boolean
}

interface FeedbackApi {
  runTx: <T>(opts: RunTxOptions<T>) => Promise<RunTxResult<T>>
  toast: (message: string, kind?: ToastKind) => void
}

const FeedbackContext = createContext<FeedbackApi | null>(null)

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used within a FeedbackProvider')
  return ctx
}

type Phase = 'confirm' | 'pending' | 'success' | 'error'
interface TxState {
  phase: Phase
  opts: RunTxOptions<unknown>
  error?: string
  hash?: string | null
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TxState | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const resolver = useRef<((r: RunTxResult) => void) | null>(null)
  const optsRef = useRef<RunTxOptions<unknown> | null>(null)
  const resultRef = useRef<unknown>(undefined)
  const toastId = useRef(0)

  const settle = useCallback((r: RunTxResult) => {
    resolver.current?.(r)
    resolver.current = null
    optsRef.current = null
    resultRef.current = undefined
    setState(null)
  }, [])

  const execute = useCallback(async () => {
    const opts = optsRef.current
    if (!opts) return
    setState({ phase: 'pending', opts })
    try {
      const result = await opts.action()
      resultRef.current = result
      const hash = (opts.showExplorer ?? true) ? consumeLastTxHash() : null
      if (opts.silentSuccess) {
        settle({ ok: true, result })
        return
      }
      setState({ phase: 'success', opts, hash })
    } catch (e) {
      setState({
        phase: 'error',
        opts,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }, [settle])

  const runTx = useCallback(
    <T,>(opts: RunTxOptions<T>): Promise<RunTxResult<T>> =>
      new Promise<RunTxResult<T>>((resolve) => {
        resolver.current = resolve as (r: RunTxResult) => void
        optsRef.current = opts as RunTxOptions<unknown>
        if (opts.confirm) setState({ phase: 'confirm', opts: opts as RunTxOptions<unknown> })
        else void execute()
      }),
    [execute],
  )

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const opts = state?.opts

  return (
    <FeedbackContext.Provider value={{ runTx, toast }}>
      {children}
      <ToastStack toasts={toasts} />

      <Modal
        open={state !== null}
        dismissable={state?.phase !== 'pending'}
        onClose={() => {
          if (state?.phase === 'confirm')
            settle({ ok: false, cancelled: true })
          else if (state?.phase === 'success')
            settle({ ok: true, result: resultRef.current })
          else if (state?.phase === 'error')
            settle({ ok: false, error: new Error(state.error) })
        }}
      >
        {state?.phase === 'confirm' && opts?.confirm && (
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-semibold">{opts.confirm.title}</h3>
            {opts.confirm.description && (
              <div className="text-on-surface-variant text-sm">
                {opts.confirm.description}
              </div>
            )}
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => settle({ ok: false, cancelled: true })}
                className="flex-1 h-12 rounded-full border border-outline-variant/60 font-semibold text-on-surface-variant"
              >
                Cancel
              </button>
              <button
                onClick={() => void execute()}
                className={`flex-1 h-12 rounded-full font-semibold text-on-primary ${
                  opts.confirm.tone === 'danger'
                    ? 'bg-error'
                    : 'bg-primary-container'
                }`}
              >
                {opts.confirm.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        )}

        {state?.phase === 'pending' && (
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <Icon
              name="progress_activity"
              className="animate-spin text-4xl text-primary-container"
            />
            <h3 className="text-lg font-semibold">
              {opts?.pendingTitle ?? 'Processing…'}
            </h3>
            <p className="text-on-surface-variant text-sm">
              {opts?.pendingDescription ?? 'Confirm in your wallet and wait for the network.'}
            </p>
          </div>
        )}

        {state?.phase === 'success' && (
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-primary-container/10 text-primary-container flex items-center justify-center">
              <Icon name="check_circle" className="text-4xl" />
            </div>
            <h3 className="text-xl font-semibold">
              {opts?.successTitle ?? 'Done'}
            </h3>
            {opts?.successDescription && (
              <div className="text-on-surface-variant text-sm">
                {opts.successDescription}
              </div>
            )}
            {opts?.successDetail && (
              <div className="w-full flex justify-between text-sm bg-surface-container-low rounded-lg px-3 py-2">
                <span className="text-on-surface-variant">
                  {opts.successDetail.label}
                </span>
                <span className="font-mono text-xs">{opts.successDetail.value}</span>
              </div>
            )}
            {state.hash && (
              <a
                href={explorerTxUrl(state.hash)}
                target="_blank"
                rel="noreferrer"
                className="text-primary-container text-sm font-semibold flex items-center gap-1"
              >
                View on Stellar Expert
                <Icon name="open_in_new" className="text-base" />
              </a>
            )}
            <div className="w-full flex flex-col gap-2 mt-2">
              {opts?.actionLabel && (
                <button
                  onClick={() => {
                    opts.onAction?.()
                    settle({ ok: true, result: resultRef.current })
                  }}
                  className="w-full h-12 rounded-full bg-primary-container text-on-primary font-semibold"
                >
                  {opts.actionLabel}
                </button>
              )}
              <button
                onClick={() => settle({ ok: true, result: resultRef.current })}
                className={`w-full h-12 rounded-full font-semibold ${
                  opts?.actionLabel
                    ? 'text-on-surface-variant'
                    : 'bg-primary-container text-on-primary'
                }`}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {state?.phase === 'error' && (
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-error-container text-error flex items-center justify-center">
              <Icon name="error" className="text-4xl" />
            </div>
            <h3 className="text-xl font-semibold">Something went wrong</h3>
            <p className="text-on-surface-variant text-sm break-words max-h-40 overflow-y-auto">
              {state.error}
            </p>
            <div className="w-full flex gap-3 mt-2">
              <button
                onClick={() => settle({ ok: false, error: new Error(state.error) })}
                className="flex-1 h-12 rounded-full border border-outline-variant/60 font-semibold text-on-surface-variant"
              >
                Close
              </button>
              <button
                onClick={() => void execute()}
                className="flex-1 h-12 rounded-full bg-primary-container text-on-primary font-semibold"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </Modal>
    </FeedbackContext.Provider>
  )
}
