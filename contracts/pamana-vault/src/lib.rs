#![no_std]

//! Pamana inheritance vault.
//!
//! A Soroban proof-of-life vault. The owner deposits USDC and periodically
//! calls `check_in` to reset a countdown. If the owner goes silent past
//! `timeout`, designated heirs claim their basis-point share directly — no
//! company, court, or lawyer in the loop. See `Pamana-Full-Document.md` §4–6.

mod types;
#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, token, Address, Env, Vec};
use types::{DataKey, Error, Heir, VaultStatus};

/// Total basis points = 100%.
const BPS_DENOM: u32 = 10_000;

// Persistent-entry TTL management (§5.2 — archival gotcha).
// Bump generously so an idle vault never archives before the timeout fires.
const BUMP_THRESHOLD: u32 = 100_000; // ~7 days of ledgers
const BUMP_AMOUNT: u32 = 2_000_000; // ~115 days of ledgers

#[contract]
pub struct PamanaVault;

#[contractimpl]
impl PamanaVault {
    /// Initialize the vault. One-time. Owner must authorize.
    pub fn init(env: Env, owner: Address, token: Address, timeout: u64) -> Result<(), Error> {
        let store = env.storage().persistent();
        if store.has(&DataKey::Owner) {
            return Err(Error::AlreadyInitialized);
        }
        owner.require_auth();

        store.set(&DataKey::Owner, &owner);
        store.set(&DataKey::Token, &token);
        store.set(&DataKey::Timeout, &timeout);
        store.set(&DataKey::LastHeartbeat, &env.ledger().timestamp());
        store.set(&DataKey::Distributing, &false);

        bump_key(&env, &DataKey::Owner);
        bump_key(&env, &DataKey::Token);
        bump_key(&env, &DataKey::Timeout);
        bump_key(&env, &DataKey::LastHeartbeat);
        bump_key(&env, &DataKey::Distributing);
        Ok(())
    }

    /// Owner deposits `amount` of the vault token into the vault.
    pub fn deposit(env: Env, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let store = env.storage().persistent();
        let owner: Address = store.get(&DataKey::Owner).ok_or(Error::NotInitialized)?;
        owner.require_auth();
        let token: Address = store.get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token).transfer(
            &owner,
            &env.current_contract_address(),
            &amount,
        );
        Ok(())
    }

    /// Proof of life. Owner resets the countdown and bumps TTL past the timeout.
    pub fn check_in(env: Env) -> Result<(), Error> {
        let store = env.storage().persistent();
        let owner: Address = store.get(&DataKey::Owner).ok_or(Error::NotInitialized)?;
        owner.require_auth();
        store.set(&DataKey::LastHeartbeat, &env.ledger().timestamp());
        bump_key(&env, &DataKey::LastHeartbeat);
        Ok(())
    }

    /// Designate heirs. Their `bps` must sum to exactly 10_000. Owner-only.
    /// A single heir is just a list of length one.
    pub fn set_heirs(env: Env, heirs: Vec<Heir>) -> Result<(), Error> {
        let store = env.storage().persistent();
        let owner: Address = store.get(&DataKey::Owner).ok_or(Error::NotInitialized)?;
        owner.require_auth();

        if heirs.is_empty() {
            return Err(Error::NoHeirs);
        }
        let mut sum: u32 = 0;
        let mut normalized: Vec<Heir> = Vec::new(&env);
        for h in heirs.iter() {
            sum += h.bps;
            normalized.push_back(Heir {
                addr: h.addr,
                bps: h.bps,
                claimed: false,
            });
        }
        if sum != BPS_DENOM {
            return Err(Error::InvalidBps);
        }

        store.set(&DataKey::Heirs, &normalized);
        bump_key(&env, &DataKey::Heirs);
        Ok(())
    }

    /// An heir claims their share. Permissionless once the owner has timed out.
    ///
    /// On the first claim the total vault balance is snapshotted into
    /// `TotalLocked` (§5.1) so later heirs are computed against the same base,
    /// never the shrinking live balance.
    pub fn claim(env: Env, heir_addr: Address) -> Result<(), Error> {
        let store = env.storage().persistent();

        let heartbeat: u64 = store
            .get(&DataKey::LastHeartbeat)
            .ok_or(Error::NotInitialized)?;
        let timeout: u64 = store.get(&DataKey::Timeout).unwrap();
        if env.ledger().timestamp() <= heartbeat + timeout {
            return Err(Error::OwnerStillActive);
        }

        let mut heirs: Vec<Heir> = store.get(&DataKey::Heirs).ok_or(Error::NoHeirs)?;
        let mut found: Option<u32> = None;
        for (i, h) in heirs.iter().enumerate() {
            if h.addr == heir_addr {
                if h.claimed {
                    return Err(Error::AlreadyClaimed);
                }
                found = Some(i as u32);
                break;
            }
        }
        let idx = found.ok_or(Error::HeirNotFound)?;

        let token: Address = store.get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token);

        // Snapshot total on the very first claim, then lock distribution state.
        let distributing: bool = store.get(&DataKey::Distributing).unwrap_or(false);
        let total: i128 = if !distributing {
            let balance = client.balance(&env.current_contract_address());
            store.set(&DataKey::TotalLocked, &balance);
            store.set(&DataKey::Distributing, &true);
            bump_key(&env, &DataKey::TotalLocked);
            bump_key(&env, &DataKey::Distributing);
            balance
        } else {
            store.get(&DataKey::TotalLocked).unwrap()
        };

        let mut heir = heirs.get(idx).unwrap();
        let amount = total * heir.bps as i128 / BPS_DENOM as i128;

        heir.claimed = true;
        heirs.set(idx, heir);
        store.set(&DataKey::Heirs, &heirs);
        bump_key(&env, &DataKey::Heirs);

        client.transfer(&env.current_contract_address(), &heir_addr, &amount);
        Ok(())
    }

    /// Permissionless TTL keepalive (§5.2). Anyone can call to keep an idle
    /// vault alive on-ledger while the owner is silent.
    pub fn bump(env: Env) {
        bump_key(&env, &DataKey::LastHeartbeat);
        bump_key(&env, &DataKey::Heirs);
        bump_key(&env, &DataKey::TotalLocked);
    }

    /// Owner reclaims funds. Blocked once distribution has begun.
    pub fn withdraw(env: Env, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let store = env.storage().persistent();
        let owner: Address = store.get(&DataKey::Owner).ok_or(Error::NotInitialized)?;
        owner.require_auth();
        if store.get(&DataKey::Distributing).unwrap_or(false) {
            return Err(Error::Distributing);
        }
        let token: Address = store.get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &owner,
            &amount,
        );
        Ok(())
    }

    // ── Views ──────────────────────────────────────────────────────────

    pub fn get_status(env: Env) -> VaultStatus {
        let store = env.storage().persistent();
        if store.get(&DataKey::Distributing).unwrap_or(false) {
            return VaultStatus::Distributing;
        }
        let heartbeat: u64 = store.get(&DataKey::LastHeartbeat).unwrap_or(0);
        let timeout: u64 = store.get(&DataKey::Timeout).unwrap_or(0);
        if env.ledger().timestamp() > heartbeat + timeout {
            VaultStatus::TimedOut
        } else {
            VaultStatus::Alive
        }
    }

    pub fn get_heirs(env: Env) -> Vec<Heir> {
        env.storage()
            .persistent()
            .get(&DataKey::Heirs)
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_owner(env: Env) -> Option<Address> {
        env.storage().persistent().get(&DataKey::Owner)
    }

    pub fn get_heartbeat(env: Env) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::LastHeartbeat)
            .unwrap_or(0)
    }

    pub fn get_timeout(env: Env) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::Timeout)
            .unwrap_or(0)
    }
}

/// Bump a persistent entry's TTL if it exists.
fn bump_key(env: &Env, key: &DataKey) {
    let store = env.storage().persistent();
    if store.has(key) {
        store.extend_ttl(key, BUMP_THRESHOLD, BUMP_AMOUNT);
    }
}
