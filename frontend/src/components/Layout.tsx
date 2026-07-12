import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'
import { useWallet } from '../contexts/WalletContext'
import { useTheme } from '../contexts/ThemeContext'
import { shortAddr } from '../lib/config'
import logo from '../assets/logo.svg'

const navItems = [
  { to: '/dashboard', icon: 'home', label: 'Home' },
  { to: '/heirs', icon: 'group', label: 'Heirs' },
  { to: '/vault', icon: 'lock', label: 'Vault', highlight: true },
  { to: '/nfc', icon: 'contactless', label: 'NFC' },
  { to: '/settings', icon: 'settings', label: 'Settings' },
]

export function Layout({ children }: { children: ReactNode }) {
  const { address, disconnect } = useWallet()
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-dvh bg-surface text-on-surface pb-[92px]">
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-outline-variant/20">
        <div className="max-w-[600px] mx-auto flex justify-between items-center px-5 h-16">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Bequest" className="w-8 h-8" />
            <h1 className="text-xl font-bold text-primary">Bequest</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="w-11 h-11 rounded-full flex items-center justify-center text-on-surface-variant bg-surface-container-low card-shadow"
            >
              <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} className="text-lg" />
            </button>
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
        </div>
      </header>

      <main className="max-w-[600px] mx-auto px-5 pt-4 pb-8 flex flex-col gap-6">
        {children}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-outline-variant/20 shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
        <div className="max-w-[600px] mx-auto flex justify-around items-end px-2 py-2">
          {navItems.map((n) =>
            n.highlight ? (
              // Distinct, raised primary button for the app's core destination.
              <NavLink key={n.to} to={n.to} className="flex flex-col items-center w-16 -mt-6">
                {({ isActive }) => (
                  <>
                    <span
                      className={`w-14 h-14 rounded-full flex items-center justify-center float-shadow ring-4 ring-surface transition-transform active:scale-95 ${
                        isActive
                          ? 'bg-primary text-on-primary'
                          : 'bg-primary-container text-on-primary'
                      }`}
                    >
                      <Icon name={n.icon} fill={isActive} className="text-2xl" />
                    </span>
                    <span
                      className={`text-[10px] leading-tight mt-1 ${
                        isActive ? 'text-primary font-bold' : 'text-primary-container font-semibold'
                      }`}
                    >
                      {n.label}
                    </span>
                  </>
                )}
              </NavLink>
            ) : (
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
            ),
          )}
        </div>
      </nav>
    </div>
  )
}
