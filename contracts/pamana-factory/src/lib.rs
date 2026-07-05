#![no_std]

//! Pamana vault factory.
//!
//! Stamps out one isolated `PamanaVault` per family and keeps an
//! owner → vault registry. Each vault holds its own funds, heirs, and
//! heartbeat — a bug or claim in one family's vault never touches another's.
//! See docs/BUILD_PLAN.md (decision 1) and Pamana-Full-Document.md.

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, vec, xdr::ToXdr, Address,
    BytesN, Env, IntoVal, Val,
};

#[contracttype]
pub enum DataKey {
    Admin,
    WasmHash,
    /// owner → deployed vault address
    Vault(Address),
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    /// This owner already has a vault.
    VaultExists = 3,
}

const BUMP_THRESHOLD: u32 = 100_000;
const BUMP_AMOUNT: u32 = 2_000_000;

#[contract]
pub struct PamanaFactory;

#[contractimpl]
impl PamanaFactory {
    /// One-time setup: record the admin and the vault wasm hash the factory
    /// will deploy. `vault_wasm_hash` comes from uploading pamana-vault's wasm.
    pub fn init(env: Env, admin: Address, vault_wasm_hash: BytesN<32>) -> Result<(), Error> {
        let s = env.storage().instance();
        if s.has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::WasmHash, &vault_wasm_hash);
        Ok(())
    }

    /// Deploy a fresh, isolated vault for `owner` and initialize it in one call.
    /// Returns the new vault's address. One vault per owner.
    pub fn create_vault(
        env: Env,
        owner: Address,
        token: Address,
        timeout: u64,
    ) -> Result<Address, Error> {
        owner.require_auth();

        let inst = env.storage().instance();
        let wasm_hash: BytesN<32> = inst.get(&DataKey::WasmHash).ok_or(Error::NotInitialized)?;

        let key = DataKey::Vault(owner.clone());
        let reg = env.storage().persistent();
        if reg.has(&key) {
            return Err(Error::VaultExists);
        }

        // Deterministic salt per owner → one address per family, no collisions.
        let salt: BytesN<32> = env.crypto().sha256(&owner.clone().to_xdr(&env)).into();
        let vault_addr = env
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(wasm_hash, ());

        // Initialize the freshly deployed vault via a cross-contract call.
        // `owner` is the tx source, so its require_auth inside init is
        // satisfied for the whole call tree. We invoke by symbol rather than
        // depending on the vault crate (whose cdylib `init` export would clash).
        let init_args: soroban_sdk::Vec<Val> = vec![
            &env,
            owner.into_val(&env),
            token.into_val(&env),
            timeout.into_val(&env),
        ];
        env.invoke_contract::<()>(&vault_addr, &symbol_short!("init"), init_args);

        reg.set(&key, &vault_addr);
        reg.extend_ttl(&key, BUMP_THRESHOLD, BUMP_AMOUNT);
        Ok(vault_addr)
    }

    // ── Views ──────────────────────────────────────────────────────────

    pub fn get_vault(env: Env, owner: Address) -> Option<Address> {
        env.storage().persistent().get(&DataKey::Vault(owner))
    }

    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }

    pub fn get_wasm_hash(env: Env) -> Option<BytesN<32>> {
        env.storage().instance().get(&DataKey::WasmHash)
    }
}
