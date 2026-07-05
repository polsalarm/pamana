import { CONFIG } from './config'
import { readContract, writeContract, addr, u64, i128 } from './stellar'

export type VaultStatus = 'Alive' | 'TimedOut' | 'Distributing'

export interface Heir {
  addr: string
  bps: number
  claimed: boolean
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

/** Deploy a fresh vault for the owner. Returns the new vault address. */
export async function createVault(
  owner: string,
  timeoutSeconds: number,
): Promise<string> {
  return writeContract<string>(
    CONFIG.factoryId,
    'create_vault',
    [addr(owner), addr(CONFIG.tokenId), u64(timeoutSeconds)],
    owner,
  )
}

// ── Vault ──────────────────────────────────────────────────────────────

export const getStatus = (vaultId: string, source: string) =>
  readContract<VaultStatus>(vaultId, 'get_status', [], source)

export const getHeartbeat = (vaultId: string, source: string) =>
  readContract<bigint>(vaultId, 'get_heartbeat', [], source)

export const getTimeout = (vaultId: string, source: string) =>
  readContract<bigint>(vaultId, 'get_timeout', [], source)

export const getHeirs = (vaultId: string, source: string) =>
  readContract<Heir[]>(vaultId, 'get_heirs', [], source)

export const deposit = (vaultId: string, owner: string, stroops: bigint) =>
  writeContract(vaultId, 'deposit', [i128(stroops)], owner)

export const checkIn = (vaultId: string, owner: string) =>
  writeContract(vaultId, 'check_in', [], owner)

/** Token balance held by the vault, in stroops. */
export const getVaultBalance = (vaultId: string, source: string) =>
  readContract<bigint>(CONFIG.tokenId, 'balance', [addr(vaultId)], source)
