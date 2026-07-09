import { Networks } from '@stellar/stellar-sdk'

/** Runtime config, sourced from Vite env (see .env.example). Falls back to the
 *  live Phase 4 Testnet deploy so the app works out of the box. */
export const CONFIG = {
  network: import.meta.env.VITE_STELLAR_NETWORK ?? 'testnet',
  rpcUrl:
    import.meta.env.VITE_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  networkPassphrase:
    import.meta.env.VITE_NETWORK_PASSPHRASE ?? Networks.TESTNET,
  horizonUrl:
    import.meta.env.VITE_HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
  factoryId:
    import.meta.env.VITE_FACTORY_CONTRACT_ID ??
    'CANQJ6N5BNPYY5CZWGRY7QTZKAY7IAIMSI7RPRNJZP564DROBWOG5PQM',
}

/** Native XLM Stellar Asset Contract on testnet. */
export const NATIVE_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'

/** Known tokens offered in the deposit picker. A vault can hold ANY Stellar
 *  asset (SAC / SEP-41) — the "Custom" path lets an owner paste any SAC id. */
export interface TokenInfo {
  symbol: string
  sac: string
  decimals: number
}
export const KNOWN_TOKENS: TokenInfo[] = [
  { symbol: 'XLM', sac: NATIVE_SAC, decimals: 7 },
]

const USER_TOKENS_KEY = 'pamana.userTokens'

/** Tokens the user added themselves (persisted in localStorage). */
export function getUserTokens(): TokenInfo[] {
  if (typeof localStorage === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(USER_TOKENS_KEY) ?? '[]')
  } catch {
    return []
  }
}

/** Add (or update) a user token; de-duped by SAC. Returns the new full list. */
export function addUserToken(t: TokenInfo): TokenInfo[] {
  const rest = getUserTokens().filter((x) => x.sac !== t.sac)
  const next = [...rest, t]
  localStorage.setItem(USER_TOKENS_KEY, JSON.stringify(next))
  return next
}

export function removeUserToken(sac: string): TokenInfo[] {
  const next = getUserTokens().filter((x) => x.sac !== sac)
  localStorage.setItem(USER_TOKENS_KEY, JSON.stringify(next))
  return next
}

/** Built-in + user-added tokens. */
export function allTokens(): TokenInfo[] {
  const seen = new Set(KNOWN_TOKENS.map((t) => t.sac))
  return [...KNOWN_TOKENS, ...getUserTokens().filter((t) => !seen.has(t.sac))]
}

export function tokenBySac(sac: string): TokenInfo {
  return (
    allTokens().find((t) => t.sac === sac) ?? {
      symbol: `${sac.slice(0, 4)}…`,
      sac,
      decimals: 7,
    }
  )
}

/** Native XLM (and the test token) uses 7 decimals. */
export const TOKEN_DECIMALS = 7
export const STROOPS_PER_UNIT = 10 ** TOKEN_DECIMALS

export const shortAddr = (a: string, n = 4) =>
  a.length > 2 * n + 3 ? `${a.slice(0, n)}…${a.slice(-n)}` : a

/** Stellar Expert explorer link for a confirmed transaction. */
export function explorerTxUrl(hash: string): string {
  const net = CONFIG.network === 'public' ? 'public' : 'testnet'
  return `https://stellar.expert/explorer/${net}/tx/${hash}`
}
