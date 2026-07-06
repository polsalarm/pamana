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

export function tokenBySac(sac: string): TokenInfo {
  return (
    KNOWN_TOKENS.find((t) => t.sac === sac) ?? {
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
