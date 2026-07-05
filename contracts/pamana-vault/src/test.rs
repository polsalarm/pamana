#![cfg(test)]

use crate::types::{Error, Heir, VaultStatus};
use crate::{PamanaVault, PamanaVaultClient};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, vec, Address, Env, Vec};

const TIMEOUT: u64 = 300; // 5-minute demo timeout, in seconds

struct Setup<'a> {
    env: Env,
    owner: Address,
    vault: PamanaVaultClient<'a>,
    token: token::TokenClient<'a>,
    token_admin: token::StellarAssetClient<'a>,
    token_addr: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);

    // A test Stellar Asset Contract to stand in for USDC.
    let sac = env.register_stellar_asset_contract_v2(owner.clone());
    let token_addr = sac.address();
    let token = token::TokenClient::new(&env, &token_addr);
    let token_admin = token::StellarAssetClient::new(&env, &token_addr);

    let vault_id = env.register(PamanaVault, ());
    let vault = PamanaVaultClient::new(&env, &vault_id);

    vault.init(&owner, &token_addr, &TIMEOUT);

    Setup {
        env,
        owner,
        vault,
        token,
        token_admin,
        token_addr,
    }
}

fn heir(_env: &Env, addr: &Address, bps: u32) -> Heir {
    Heir {
        addr: addr.clone(),
        bps,
        claimed: false,
    }
}

fn advance_past_timeout(env: &Env) {
    env.ledger().with_mut(|l| {
        l.timestamp += TIMEOUT + 1;
    });
}

// ── Phase 1 ───────────────────────────────────────────────────────────

#[test]
fn init_sets_owner_and_alive_status() {
    let s = setup();
    assert_eq!(s.vault.get_owner(), Some(s.owner.clone()));
    assert_eq!(s.vault.get_timeout(), TIMEOUT);
    assert_eq!(s.vault.get_status(), VaultStatus::Alive);
}

#[test]
fn init_twice_fails() {
    let s = setup();
    let res = s.vault.try_init(&s.owner, &s.token_addr, &TIMEOUT);
    assert_eq!(res, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn deposit_moves_funds_into_vault() {
    let s = setup();
    s.token_admin.mint(&s.owner, &1_000);
    s.vault.deposit(&500);
    assert_eq!(s.token.balance(&s.vault.address), 500);
    assert_eq!(s.token.balance(&s.owner), 500);
}

#[test]
fn deposit_zero_fails() {
    let s = setup();
    let res = s.vault.try_deposit(&0);
    assert_eq!(res, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn claim_before_timeout_fails() {
    let s = setup();
    let h = Address::generate(&s.env);
    s.token_admin.mint(&s.owner, &1_000);
    s.vault.deposit(&1_000);
    s.vault.set_heirs(&vec![&s.env, heir(&s.env, &h, 10_000)]);

    let res = s.vault.try_claim(&h);
    assert_eq!(res, Err(Ok(Error::OwnerStillActive)));
}

#[test]
fn check_in_resets_countdown() {
    let s = setup();
    let h = Address::generate(&s.env);
    s.token_admin.mint(&s.owner, &1_000);
    s.vault.deposit(&1_000);
    s.vault.set_heirs(&vec![&s.env, heir(&s.env, &h, 10_000)]);

    advance_past_timeout(&s.env);
    // Owner proves life right before an heir claims.
    s.vault.check_in();
    assert_eq!(s.vault.get_status(), VaultStatus::Alive);

    let res = s.vault.try_claim(&h);
    assert_eq!(res, Err(Ok(Error::OwnerStillActive)));
}

#[test]
fn single_heir_claims_full_balance() {
    let s = setup();
    let h = Address::generate(&s.env);
    s.token_admin.mint(&s.owner, &1_000);
    s.vault.deposit(&1_000);
    s.vault.set_heirs(&vec![&s.env, heir(&s.env, &h, 10_000)]);

    advance_past_timeout(&s.env);
    assert_eq!(s.vault.get_status(), VaultStatus::TimedOut);
    s.vault.claim(&h);

    assert_eq!(s.token.balance(&h), 1_000);
    assert_eq!(s.token.balance(&s.vault.address), 0);
    assert_eq!(s.vault.get_status(), VaultStatus::Distributing);
}

#[test]
fn double_claim_single_heir_fails() {
    let s = setup();
    let h = Address::generate(&s.env);
    s.token_admin.mint(&s.owner, &1_000);
    s.vault.deposit(&1_000);
    s.vault.set_heirs(&vec![&s.env, heir(&s.env, &h, 10_000)]);

    advance_past_timeout(&s.env);
    s.vault.claim(&h);
    let res = s.vault.try_claim(&h);
    assert_eq!(res, Err(Ok(Error::AlreadyClaimed)));
}

#[test]
fn withdraw_returns_funds_to_owner() {
    let s = setup();
    s.token_admin.mint(&s.owner, &1_000);
    s.vault.deposit(&1_000);
    s.vault.withdraw(&400);
    assert_eq!(s.token.balance(&s.owner), 400);
    assert_eq!(s.token.balance(&s.vault.address), 600);
}

// ── Phase 2 ───────────────────────────────────────────────────────────

fn two_heirs(env: &Env, a: &Address, b: &Address) -> Vec<Heir> {
    vec![env, heir(env, a, 7_000), heir(env, b, 3_000)]
}

#[test]
fn set_heirs_rejects_wrong_bps_sum() {
    let s = setup();
    let a = Address::generate(&s.env);
    let b = Address::generate(&s.env);
    // 7000 + 2000 = 9000, not 10000.
    let bad = vec![&s.env, heir(&s.env, &a, 7_000), heir(&s.env, &b, 2_000)];
    let res = s.vault.try_set_heirs(&bad);
    assert_eq!(res, Err(Ok(Error::InvalidBps)));
}

#[test]
fn set_heirs_rejects_empty() {
    let s = setup();
    let empty: Vec<Heir> = Vec::new(&s.env);
    let res = s.vault.try_set_heirs(&empty);
    assert_eq!(res, Err(Ok(Error::NoHeirs)));
}

#[test]
fn two_heirs_split_correctly_in_order_a_then_b() {
    let s = setup();
    let a = Address::generate(&s.env);
    let b = Address::generate(&s.env);
    s.token_admin.mint(&s.owner, &1_000);
    s.vault.deposit(&1_000);
    s.vault.set_heirs(&two_heirs(&s.env, &a, &b));

    advance_past_timeout(&s.env);
    s.vault.claim(&a);
    s.vault.claim(&b);

    assert_eq!(s.token.balance(&a), 700);
    assert_eq!(s.token.balance(&b), 300);
    assert_eq!(s.token.balance(&s.vault.address), 0);
}

#[test]
fn two_heirs_split_correctly_in_order_b_then_a() {
    let s = setup();
    let a = Address::generate(&s.env);
    let b = Address::generate(&s.env);
    s.token_admin.mint(&s.owner, &1_000);
    s.vault.deposit(&1_000);
    s.vault.set_heirs(&two_heirs(&s.env, &a, &b));

    advance_past_timeout(&s.env);
    // Reverse claim order must NOT change amounts (TotalLocked snapshot §5.1).
    s.vault.claim(&b);
    s.vault.claim(&a);

    assert_eq!(s.token.balance(&a), 700);
    assert_eq!(s.token.balance(&b), 300);
}

#[test]
fn snapshot_is_immutable_after_first_claim() {
    let s = setup();
    let a = Address::generate(&s.env);
    let b = Address::generate(&s.env);
    s.token_admin.mint(&s.owner, &1_000);
    s.vault.deposit(&1_000);
    s.vault.set_heirs(&two_heirs(&s.env, &a, &b));

    advance_past_timeout(&s.env);
    s.vault.claim(&a); // balance drops to 300, snapshot pinned at 1000
    // b's 30% must still compute from 1000, not the remaining 300.
    s.vault.claim(&b);
    assert_eq!(s.token.balance(&b), 300);
}

#[test]
fn heir_not_found_fails() {
    let s = setup();
    let a = Address::generate(&s.env);
    let b = Address::generate(&s.env);
    let stranger = Address::generate(&s.env);
    s.token_admin.mint(&s.owner, &1_000);
    s.vault.deposit(&1_000);
    s.vault.set_heirs(&two_heirs(&s.env, &a, &b));

    advance_past_timeout(&s.env);
    let res = s.vault.try_claim(&stranger);
    assert_eq!(res, Err(Ok(Error::HeirNotFound)));
}

#[test]
fn withdraw_blocked_after_distribution_starts() {
    let s = setup();
    let a = Address::generate(&s.env);
    let b = Address::generate(&s.env);
    s.token_admin.mint(&s.owner, &1_000);
    s.vault.deposit(&1_000);
    s.vault.set_heirs(&two_heirs(&s.env, &a, &b));

    advance_past_timeout(&s.env);
    s.vault.claim(&a);
    let res = s.vault.try_withdraw(&100);
    assert_eq!(res, Err(Ok(Error::Distributing)));
}
