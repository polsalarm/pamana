#![no_std]

//! Pamana RWA valuation oracle (Phase 2).
//!
//! Replaces the hardcoded RWA value with a signed, on-chain attestation. A
//! registered appraiser attests `(asset, value_php, doc_hash)`; the vault UI
//! reads the latest attestation instead of a constant, and can show how stale
//! it is. `doc_hash` binds the figure to a specific off-chain signed appraisal.
//!
//! Trust model is single-signer per attestation with an admin-managed appraiser
//! set — designed to grow into an M-of-N appraiser quorum (Phase 2+). This is
//! attested valuation, not a streamed DeFi price feed.

pub mod types;
#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Vec};
use types::{Attestation, DataKey, Error};

// Persistent-entry TTL management (mirrors the vault's archival handling).
const BUMP_THRESHOLD: u32 = 100_000; // ~7 days of ledgers
const BUMP_AMOUNT: u32 = 2_000_000; // ~115 days of ledgers

#[contract]
pub struct PamanaOracle;

#[contractimpl]
impl PamanaOracle {
    /// Initialize the oracle with an admin. One-time.
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        let store = env.storage().instance();
        if store.has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Appraisers, &Vec::<Address>::new(&env));
        store.extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
        Ok(())
    }

    /// Register an appraiser. Admin-only.
    pub fn add_appraiser(env: Env, appraiser: Address) -> Result<(), Error> {
        let store = env.storage().instance();
        let admin: Address = store.get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        admin.require_auth();
        let mut list: Vec<Address> =
            store.get(&DataKey::Appraisers).unwrap_or(Vec::new(&env));
        if list.iter().any(|a| a == appraiser) {
            return Err(Error::AlreadyAppraiser);
        }
        list.push_back(appraiser);
        store.set(&DataKey::Appraisers, &list);
        store.extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
        Ok(())
    }

    /// Remove an appraiser. Admin-only. No-op if not registered.
    pub fn remove_appraiser(env: Env, appraiser: Address) -> Result<(), Error> {
        let store = env.storage().instance();
        let admin: Address = store.get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        admin.require_auth();
        let list: Vec<Address> =
            store.get(&DataKey::Appraisers).unwrap_or(Vec::new(&env));
        let mut next = Vec::new(&env);
        for a in list.iter() {
            if a != appraiser {
                next.push_back(a);
            }
        }
        store.set(&DataKey::Appraisers, &next);
        Ok(())
    }

    /// A registered appraiser attests the value of `asset` (its SAC address),
    /// binding a signed appraisal via `doc_hash`. Overwrites any prior
    /// attestation for that asset with a fresh timestamp.
    pub fn attest(
        env: Env,
        appraiser: Address,
        asset: Address,
        value_php: i128,
        doc_hash: BytesN<32>,
    ) -> Result<(), Error> {
        if value_php <= 0 {
            return Err(Error::InvalidValue);
        }
        appraiser.require_auth();
        if !Self::is_appraiser(env.clone(), appraiser.clone()) {
            return Err(Error::NotAppraiser);
        }
        let att = Attestation {
            value_php,
            doc_hash,
            appraiser,
            timestamp: env.ledger().timestamp(),
        };
        let store = env.storage().persistent();
        store.set(&DataKey::Attestation(asset.clone()), &att);
        store.extend_ttl(&DataKey::Attestation(asset), BUMP_THRESHOLD, BUMP_AMOUNT);
        Ok(())
    }

    /// Latest attestation for `asset` (its SAC address).
    pub fn get_attestation(env: Env, asset: Address) -> Result<Attestation, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Attestation(asset))
            .ok_or(Error::NoAttestation)
    }

    /// Whether `addr` is a registered appraiser.
    pub fn is_appraiser(env: Env, addr: Address) -> bool {
        let list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Appraisers)
            .unwrap_or(Vec::new(&env));
        list.iter().any(|a| a == addr)
    }

    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }

    pub fn get_appraisers(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Appraisers)
            .unwrap_or(Vec::new(&env))
    }
}
