# Stitch Design Prompt — Pamana

Paste the **App context** block first, then generate each screen with its own prompt. **Mobile-first, Android-tested, installable PWA** (heirs claim on phones; NFC tap-to-claim is Android Chrome). The same design scales to desktop web.

> Wallet note: on Android there is no Freighter extension — connect via a mobile wallet (LOBSTR/WalletConnect) or a passkey smart account (fingerprint/face). Design the "Connect Wallet" screen as a generic multi-wallet chooser, not Freighter-specific.

---

## App context (paste once, keep at top)

> Design a mobile-first PWA called **Pamana** — a trustless on-chain inheritance wallet for Filipino families, built on the Stellar blockchain. An owner deposits crypto (USDC/XLM) into a personal vault and periodically taps "I'm Alive" to prove they're active. If they go silent past a timeout, their designated heirs automatically claim their share. The emotional core is **trust, family, and peace of mind** — not crypto hype.
>
> **Brand & tone:** warm, reassuring, human, quietly premium. Feels like a trusted family institution, not a trading app. Filipino context (peso amounts, family framing) but globally clean.
>
> **Visual language:**
> - Palette: deep forest/emerald green as primary (growth, security, "pamana"=heritage), warm gold/amber accent for the heartbeat/alive state, soft cream/off-white backgrounds, charcoal text. Amber = "inheritance unlocked" state.
> - Rounded cards (16–24px radius), generous spacing, soft shadows, large friendly typography (a humanist sans like Inter/General Sans). Big tap targets.
> - A recurring **status light** motif: a glowing dot/ring — green = "Alive", amber/pulsing = "Inheritance Unlocked".
> - Iconography: simple line icons; a coin/heritage 🪙 motif for the logo.
> - Accessibility: high contrast, legible for older/non-technical heirs. Support light and dark mode.

---

## Screens

### 1. Landing / Connect Wallet
Hero screen. App name **Pamana**, tagline "Your pamana moves on its own." One primary button **Connect Wallet** that opens a multi-wallet chooser sheet (options: passkey / fingerprint, LOBSTR, Freighter, xBull) — not Freighter-specific. A short 3-step "how it works" strip (Create vault → Add heirs → Stay alive). Trust signals: "Enforced on-chain. No company holds your keys." Bottom: "Powered by Stellar."

### 2. Owner Dashboard (the home screen)
The most important screen. Show:
- A large **status card** with the glowing status light: "Alive — next check-in in 89 days" and a circular countdown ring.
- A big primary button **I'm Alive** (check-in).
- **Vault balance** card (e.g. "₱28,600 · 500 USDC") with a small PHP/crypto toggle.
- Quick actions row: Deposit, Add Heirs, Withdraw.
- A compact **Heirs** summary list (avatars + names + % share).
- Bottom nav: Home · Heirs · Activity · Settings.

### 3. Create Vault (first-run)
Simple setup flow: choose the check-in timeout (a slider/preset chips: 30 / 60 / 90 days), confirm token, one **Create My Vault** button that triggers a Freighter signature. Reassuring copy explaining what happens.

### 4. Manage Heirs
List of heirs, each a card with avatar, wallet address (truncated `GDEF…HEIR`), and an editable **basis-point / percentage share**. A live total indicator that must equal 100% (show it turn green at exactly 100%, red otherwise). "Add heir" button opens a sheet to paste a Stellar address + set share. Optional per-heir **Trust-Fund Schedule** toggle (release in tranches over years).

### 5. Deposit
Enter amount (PHP-first input with live crypto equivalent), show the vault it funds, **Deposit** button → Freighter signature. Clean confirmation state.

### 6. Heir Claim
The heir's view (they may be non-technical). Big empathetic screen: "You have an inheritance to claim." Show the amount, who it's from, and one large **Claim My Share** button. If the owner is still active, show a calm locked state: "Protected — [name] is still active." Success state celebrates gently.

### 7. Off-Ramp (PHP cash-out)
Convert claimed USDC to Philippine pesos via PDAX. Show live rate ("350 USDC ≈ ₱20,020 at ₱57.20"), choose payout (GCash / Maya / bank), **Withdraw** button.

---

## Tips
- Ask Stitch for **light + dark** variants of the Dashboard and Heir Claim first — those two set the whole system.
- Keep the status light consistent across every screen; it's the brand anchor.
- Emphasize the **Dashboard** and **Heir Claim** screens — they carry the demo.
