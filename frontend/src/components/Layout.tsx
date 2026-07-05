import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'
import { useWallet } from '../contexts/WalletContext'
import { shortAddr } from '../lib/config'
import logo from '../assets/logo.svg'

const navItems = [
  { to: '/dashboard', icon: 'home', label: 'Home' },
  { to: '/heirs', icon: 'group', label: 'Heirs' },
  { to: '/activity', icon: 'history', label: 'Activity' },
  { to: '/settings', icon: 'settings', label: 'Settings' },
]

export function Layout({ children }: { children: ReactNode }) {
  const { address, disconnect } = useWallet()

  return (
    <div className="min-h-dvh bg-surface text-on-surface pb-[84px]">
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-outline-variant/20">
        <div className="max-w-[600px] mx-auto flex justify-between items-center px-5 h-16">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Pamana" className="w-8 h-8" />
            <h1 className="text-xl font-bold text-primary">Pamana</h1>
          </div>
          {address && (
            <button
              onClick={disconnect}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-secondary-container/60 bg-surface-container-low card-shadow"
            >
              <span className="w-2 h-2 rounded-full bg-secondary-container" />
              <span className="text-xs font-medium text-on-surface-variant">
                {shortAddr(address)}
              </span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-[600px] mx-auto px-5 pt-4 pb-8 flex flex-col gap-6">
        {children}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-outline-variant/20 shadow-[0_-10px_30px_rgba(6,78,59,0.05)]">
        <div className="max-w-[600px] mx-auto flex justify-around items-center px-4 py-2">
          {navItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-16 rounded-lg py-1.5 transition-colors ${
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={n.icon} fill={isActive} className="mb-0.5" />
                  <span className="text-[10px] leading-tight">{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
