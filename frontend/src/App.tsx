import { Routes, Route, Navigate } from 'react-router-dom'
import { useWallet } from './contexts/WalletContext'
import { Landing } from './pages/landing/Landing'
import { Dashboard } from './pages/owner/Dashboard'
import { Vault } from './pages/owner/Vault'
import { CreateVault } from './pages/owner/CreateVault'
import { Deposit } from './pages/owner/Deposit'
import { Withdraw } from './pages/owner/Withdraw'
import { ManageHeirs } from './pages/owner/ManageHeirs'
import { Recovery } from './pages/owner/Recovery'
import { Claim } from './pages/heir/Claim'
import { OffRamp } from './pages/heir/OffRamp'
import { Activity } from './pages/Activity'
import { Nfc } from './pages/Nfc'
import { Placeholder } from './pages/Placeholder'
import type { ReactNode } from 'react'

/** Gate owner routes behind a connected wallet. Waits for the persisted
 *  session to restore so a hard load of a deep link doesn't bounce. */
function RequireWallet({ children }: { children: ReactNode }) {
  const { address, restoring } = useWallet()
  if (restoring) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-surface">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary-container">
          progress_activity
        </span>
      </div>
    )
  }
  if (!address) return <Navigate to="/" replace />
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/dashboard"
        element={
          <RequireWallet>
            <Dashboard />
          </RequireWallet>
        }
      />
      <Route
        path="/vault"
        element={
          <RequireWallet>
            <Vault />
          </RequireWallet>
        }
      />
      <Route
        path="/create"
        element={
          <RequireWallet>
            <CreateVault />
          </RequireWallet>
        }
      />
      <Route
        path="/deposit"
        element={
          <RequireWallet>
            <Deposit />
          </RequireWallet>
        }
      />
      <Route
        path="/heirs"
        element={
          <RequireWallet>
            <ManageHeirs />
          </RequireWallet>
        }
      />
      <Route
        path="/claim"
        element={
          <RequireWallet>
            <Claim />
          </RequireWallet>
        }
      />
      <Route
        path="/recovery"
        element={
          <RequireWallet>
            <Recovery />
          </RequireWallet>
        }
      />
      <Route
        path="/offramp"
        element={
          <RequireWallet>
            <OffRamp />
          </RequireWallet>
        }
      />
      <Route
        path="/withdraw"
        element={
          <RequireWallet>
            <Withdraw />
          </RequireWallet>
        }
      />
      <Route
        path="/nfc"
        element={
          <RequireWallet>
            <Nfc />
          </RequireWallet>
        }
      />
      <Route
        path="/activity"
        element={
          <RequireWallet>
            <Activity />
          </RequireWallet>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireWallet>
            <Placeholder title="Settings" phase="a later phase" />
          </RequireWallet>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
