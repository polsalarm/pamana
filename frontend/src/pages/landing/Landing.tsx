import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Icon } from '../../components/Icon'
import { useWallet } from '../../contexts/WalletContext'
import logo from '../../assets/logo.svg'

const steps = [
  { icon: 'lock', title: 'Create vault', body: 'Secure your assets in a personal on-chain vault on Stellar.' },
  { icon: 'group_add', title: 'Add heirs', body: 'Designate family and assign each a clear inheritance share.' },
  { icon: 'favorite', title: 'Stay alive', body: 'Check in periodically to prove vitality. Pamana handles the rest.' },
]

export function Landing() {
  const { address, connect, connecting } = useWallet()
  const navigate = useNavigate()

  useEffect(() => {
    if (address) navigate('/dashboard', { replace: true })
  }, [address, navigate])

  return (
    <div className="min-h-dvh bg-surface text-on-surface relative overflow-x-hidden">
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-primary-fixed-dim/20 blur-3xl pointer-events-none" />
      <main className="relative z-10 max-w-[600px] mx-auto min-h-dvh flex flex-col px-5 pt-10 pb-8">
        <header className="flex flex-col items-center pt-6 pb-6">
          <div className="relative w-24 h-24 flex items-center justify-center mb-2">
            <img src={logo} alt="Pamana" className="w-24 h-24 relative z-10" />
            <div className="absolute inset-0 border-2 border-primary-container/10 rounded-full animate-ping [animation-duration:3s]" />
          </div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Pamana</h1>
        </header>

        <section className="flex flex-col items-center text-center flex-grow justify-center mb-8">
          <h2 className="text-4xl font-bold leading-tight mb-3">
            Your pamana moves on its own.
          </h2>
          <p className="text-lg text-on-surface-variant max-w-sm mb-8">
            A self-executing legacy vault that cares for your family — with no
            company, lawyer, or court in the loop.
          </p>
          <button
            onClick={connect}
            disabled={connecting}
            className="w-full max-w-sm bg-primary-container text-on-primary h-14 rounded-full font-semibold uppercase tracking-wider hover:opacity-90 active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-2 card-shadow"
          >
            {connecting ? 'Connecting…' : 'Connect Wallet'}
            <Icon name="wallet" fill />
          </button>
        </section>

        <section className="mb-8 w-full">
          <h3 className="text-xs text-on-surface-variant uppercase tracking-widest text-center mb-3 opacity-60">
            How it works
          </h3>
          <div className="flex flex-col gap-3">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className={`rounded-2xl p-5 card-shadow flex items-start gap-4 ${
                  i === 2
                    ? 'bg-primary-container text-on-primary'
                    : 'bg-surface-container-lowest border border-outline-variant/30'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    i === 2 ? 'bg-on-primary/10' : 'bg-primary-container/10 text-primary-container'
                  }`}
                >
                  <Icon name={s.icon} />
                </div>
                <div>
                  <h4 className="font-semibold mb-0.5">{s.title}</h4>
                  <p className={`text-sm ${i === 2 ? 'text-primary-fixed-dim' : 'text-on-surface-variant'}`}>
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-auto pt-5 border-t border-outline-variant/20 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-on-surface-variant/80">
            <Icon name="verified_user" className="text-base" />
            <span className="text-xs tracking-wider">
              Enforced on-chain. No company holds your keys.
            </span>
          </div>
          <span className="text-xs tracking-wider uppercase text-on-surface-variant/60">
            Powered by Stellar
          </span>
        </footer>
      </main>
    </div>
  )
}
