import { xdr, nativeToScVal, Address } from '@stellar/stellar-sdk'
import { CONFIG } from './config'
import { readContract, writeContract, addr, u64, i128 } from './stellar'

export type VaultStatus = 'Alive' | 'TimedOut' | 'Distributing'

export interface Heir {
  addr: string
  bps: number
}

// ── Factory ────────────────────────────────────────────────────────────

/** The vault address for an owner, or null if they don't have one yet. */
export async function getVault(owner: string): Promise<string | null> {
  const res = await readContract<string | null>(
    CONFIG.factoryId,
    'get_vault',
    [addr(owner)],
    owner,
  )
  return res ?? null
}

/** Deploy a fresh vault for the owner. Returns the new vault address.
 *  Tokens are added per-vault on deposit — none is fixed at creation. */
export async function createVault(
  owner: string,
  timeoutSeconds: number,
): Promise<string> {
  return writeContract<string>(
    CONFIG.factoryId,
    'create_vault',
    [addr(owner), u64(timeoutSeconds)],
    owner,
  )
}

// ── Vault ──────────────────────────────────────────────────────────────

/** Vault status. Soroban encodes the enum as a single-element vec, so the raw
 *  value arrives as `['Distributing']`; unwrap it once here so every caller can
 *  compare against the bare string. */
export const getStatus = async (
  vaultId: string,
  source: string,
): Promise<VaultStatus> => {
  const s = await readContract<VaultStatus | VaultStatus[]>(
    vaultId,
    'get_status',
    [],
    source,
  )
  return Array.isArray(s) ? s[0] : s
}

export const getHeartbeat = (vaultId: string, source: string) =>
  readContract<bigint>(vaultId, 'get_heartbeat', [], source)

export const getTimeout = (vaultId: string, source: string) =>
  readContract<bigint>(vaultId, 'get_timeout', [], source)

export const getHeirs = (vaultId: string, source: string) =>
  readContract<Heir[]>(vaultId, 'get_heirs', [], source)

/** Tokens (SAC addresses) this vault currently holds. */
export const getTokens = (vaultId: string, source: string) =>
  readContract<string[]>(vaultId, 'get_tokens', [], source)

/** Whether a lump-sum heir has already claimed a given token. */
export const isClaimed = (
  vaultId: string,
  token: string,
  heirAddr: string,
  source: string,
) =>
  readContract<boolean>(
    vaultId,
    'is_claimed',
    [addr(token), addr(heirAddr)],
    source,
  )

export const deposit = (
  vaultId: string,
  owner: string,
  token: string,
  stroops: bigint,
) => writeContract(vaultId, 'deposit', [addr(token), i128(stroops)], owner)

/** Owner reclaims `stroops` of `token` from the vault back to their wallet.
 *  Blocked once distribution has begun (enforced on-chain). */
export const withdraw = (
  vaultId: string,
  owner: string,
  token: string,
  stroops: bigint,
) => writeContract(vaultId, 'withdraw', [addr(token), i128(stroops)], owner)

export const checkIn = (vaultId: string, owner: string) =>
  writeContract(vaultId, 'check_in', [], owner)

/** One Heir struct → ScVal map (fields sorted: addr, bps). */
function heirScVal(h: Heir): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: nativeToScVal('addr', { type: 'symbol' }),
      val: new Address(h.addr).toScVal(),
    }),
    new xdr.ScMapEntry({
      key: nativeToScVal('bps', { type: 'symbol' }),
      val: nativeToScVal(h.bps, { type: 'u32' }),
    }),
  ])
}

/** Set the vault's heirs. `bps` must sum to 10_000 (enforced on-chain too). */
export const setHeirs = (vaultId: string, owner: string, heirs: Heir[]) =>
  writeContract(
    vaultId,
    'set_heirs',
    [xdr.ScVal.scvVec(heirs.map(heirScVal))],
    owner,
  )

/** An heir claims their share of `token`. Permissionless; `source` (the heir)
 *  pays the fee. */
export const claim = (
  vaultId: string,
  token: string,
  heirAddr: string,
  source: string,
) => writeContract(vaultId, 'claim', [addr(token), addr(heirAddr)], source)

/** Balance of `token` held by the vault, in stroops. */
export const getVaultBalance = (
  token: string,
  vaultId: string,
  source: string,
) => readContract<bigint>(token, 'balance', [addr(vaultId)], source)
