#![cfg(test)]

use crate::{Error, PamanaFactory, PamanaFactoryClient};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, vec, Address, BytesN, Env};

// Import the compiled vault wasm so the factory can deploy real instances of it.
mod vault {
    soroban_sdk::contractimport!(
        file = "../target/wasm32v1-none/release/pamana_vault.wasm"
    );
}

struct Setup<'a> {
    env: Env,
    admin: Address,
    factory: PamanaFactoryClient<'a>,
    wasm_hash: BytesN<32>,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let wasm_hash = env.deployer().upload_contract_wasm(vault::WASM);

    let fid = env.register(PamanaFactory, ());
    let factory = PamanaFactoryClient::new(&env, &fid);
    factory.init(&admin, &wasm_hash);

    Setup {
        env,
        admin,
        factory,
        wasm_hash,
    }
}

#[test]
fn init_stores_admin_and_hash() {
    let s = setup();
    assert_eq!(s.factory.get_admin(), Some(s.admin.clone()));
    assert_eq!(s.factory.get_wasm_hash(), Some(s.wasm_hash.clone()));
}

#[test]
fn init_twice_fails() {
    let s = setup();
    let res = s.factory.try_init(&s.admin, &s.wasm_hash);
    assert_eq!(res, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn create_vault_deploys_and_initializes() {
    let s = setup();
    let owner = Address::generate(&s.env);
    let token = s
        .env
        .register_stellar_asset_contract_v2(owner.clone())
        .address();

    let vault_addr = s.factory.create_vault(&owner, &token, &300);

    // Registry updated.
    assert_eq!(s.factory.get_vault(&owner), Some(vault_addr.clone()));

    // The deployed instance is a real, initialized vault owned by `owner`.
    let v = vault::Client::new(&s.env, &vault_addr);
    assert_eq!(v.get_owner(), Some(owner.clone()));
    assert_eq!(v.get_timeout(), 300);
}

#[test]
fn two_owners_get_isolated_vaults() {
    let s = setup();
    let owner_a = Address::generate(&s.env);
    let owner_b = Address::generate(&s.env);
    let token = s
        .env
        .register_stellar_asset_contract_v2(owner_a.clone())
        .address();

    let vault_a = s.factory.create_vault(&owner_a, &token, &300);
    let vault_b = s.factory.create_vault(&owner_b, &token, &300);

    assert_ne!(vault_a, vault_b);
    assert_eq!(s.factory.get_vault(&owner_a), Some(vault_a));
    assert_eq!(s.factory.get_vault(&owner_b), Some(vault_b));
}

#[test]
fn duplicate_vault_for_owner_fails() {
    let s = setup();
    let owner = Address::generate(&s.env);
    let token = s
        .env
        .register_stellar_asset_contract_v2(owner.clone())
        .address();

    s.factory.create_vault(&owner, &token, &300);
    let res = s.factory.try_create_vault(&owner, &token, &300);
    assert_eq!(res, Err(Ok(Error::VaultExists)));
}

#[test]
fn factory_deployed_vault_runs_full_inheritance_flow() {
    let s = setup();
    let owner = Address::generate(&s.env);
    let heir = Address::generate(&s.env);

    let sac = s.env.register_stellar_asset_contract_v2(owner.clone());
    let token = sac.address();
    let token_client = token::TokenClient::new(&s.env, &token);
    let token_admin = token::StellarAssetClient::new(&s.env, &token);

    let vault_addr = s.factory.create_vault(&owner, &token, &300);
    let v = vault::Client::new(&s.env, &vault_addr);

    token_admin.mint(&owner, &1_000);
    v.deposit(&1_000);
    v.set_heirs(&vec![
        &s.env,
        vault::Heir {
            addr: heir.clone(),
            bps: 10_000,
            claimed: false,
        },
    ]);

    s.env.ledger().with_mut(|l| l.timestamp += 301);
    v.claim(&heir);

    assert_eq!(token_client.balance(&heir), 1_000);
    assert_eq!(token_client.balance(&vault_addr), 0);
}
