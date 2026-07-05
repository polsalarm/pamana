import { Networks } from '@stellar/stellar-sdk'

/** Runtime config, sourced from Vite env (see .env.example). Falls back to the
 *  live Phase 4 Testnet deploy so the app works out of the box. */
export const CONFIG = {
  network: import.meta.env.VITE_STELLAR_NETWORK ?? 'testnet',
  rpcUrl:
    import.meta.env.VITE_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  networkPassphrase:
    import.meta.env.VITE_NETWORK_PASSPHRASE ?? Networks.TESTNET,
  factoryId:
    import.meta.env.VITE_FACTORY_CONTRACT_ID ??
    'CAMKUFDTTIVDL4Z2UV6UISUDGSONOCCEZHTYH3EFTIA2ILSLLKV4F5RH',
  tokenId:
    import.meta.env.VITE_TOKEN_SAC_ID ??
    'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
}

/** Native XLM (and the test token) uses 7 decimals. */
export const TOKEN_DECIMALS = 7
export const STROOPS_PER_UNIT = 10 ** TOKEN_DECIMALS

export const shortAddr = (a: string, n = 4) =>
  a.length > 2 * n + 3 ? `${a.slice(0, n)}…${a.slice(-n)}` : a
