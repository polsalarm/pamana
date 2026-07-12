import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import { connectWallet, kit } from '../lib/wallet'
import { DEMO_OWNER, demoCaptureEnabled } from '../lib/devDemo'

interface WalletState {
  address: string | null
  connecting: boolean
  /** True while we're restoring a persisted session on load. Route guards
   *  must wait for this to finish before redirecting, or a hard load of a
   *  gated deep link bounces before the wallet is known. */
  restoring: boolean
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletCtx = createContext<WalletState | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [restoring, setRestoring] = useState(true)

  // The kit persists the selected wallet in its own state module; try to
  // restore the address on load so a refresh keeps the user connected.
  useEffect(() => {
    if (demoCaptureEnabled()) {
      setAddress(DEMO_OWNER)
      setRestoring(false)
      return
    }

    kit
      .getAddress()
      .then(({ address }) => address && setAddress(address))
      .catch(() => {
        /* not connected yet */
      })
      .finally(() => setRestoring(false))
  }, [])

  const connect = useCallback(async () => {
    if (demoCaptureEnabled()) {
      setAddress(DEMO_OWNER)
      return
    }

    setConnecting(true)
    try {
      setAddress(await connectWallet())
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    if (demoCaptureEnabled()) return
    kit.disconnect().catch(() => {})
    setAddress(null)
  }, [])

  return (
    <WalletCtx.Provider value={{ address, connecting, restoring, connect, disconnect }}>
      {children}
    </WalletCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWallet() {
  const ctx = useContext(WalletCtx)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}