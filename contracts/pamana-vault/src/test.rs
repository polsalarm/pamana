#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Address, Env, String};

fn setup() -> (Env, PalengkePaymentClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PalengkePayment, ());
    let client = PalengkePaymentClient::new(&env, &contract_id);
    (env, client)
}

fn setup_initialized() -> (Env, PalengkePaymentClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(token_admin);
    let token_address = asset.address();

    let contract_id = env.register(PalengkePayment, ());
    let client = PalengkePaymentClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin, &0u32, &token_address);

    (env, client, token_address)
}

fn mint_to(env: &Env, token: &Address, to: &Address, amount: i128) {
    StellarAssetClient::new(env, token).mint(to, &amount);
}

#[test]
fn test_payment_count_starts_zero() {
    let (_, client) = setup();
    assert_eq!(client.payment_count(), 0);
}

#[test]
fn test_pay_increments_count() {
    let (env, client, token) = setup_initialized();
    let customer = Address::generate(&env);
    let vendor = Address::generate(&env);
    mint_to(&env, &token, &customer, 1_000_000_000i128);
    let memo = String::from_str(&env, "2kg tilapia");

    client.pay(&customer, &vendor, &10_000_000i128, &memo);
    assert_eq!(client.payment_count(), 1);

    client.pay(&customer, &vendor, &5_000_000i128, &memo);
    assert_eq!(client.payment_count(), 2);
}

#[test]
fn test_get_payment_returns_correct_data() {
    let (env, client, token) = setup_initialized();
    let customer = Address::generate(&env);
    let vendor = Address::generate(&env);
    mint_to(&env, &token, &customer, 1_000_000_000i128);
    let memo = String::from_str(&env, "1kg bangus");

    let payment_id = client.pay(&customer, &vendor, &15_000_000i128, &memo);
    let payment = client.get_payment(&payment_id);

    assert_eq!(payment.customer, customer);
    assert_eq!(payment.vendor, vendor);
    assert_eq!(payment.amount, 15_000_000i128);
}

#[test]
fn test_get_vendor_payments() {
    let (env, client, token) = setup_initialized();
    let customer = Address::generate(&env);
    let vendor = Address::generate(&env);
    mint_to(&env, &token, &customer, 1_000_000_000i128);
    let memo = String::from_str(&env, "fish");

    client.pay(&customer, &vendor, &10_000_000i128, &memo);
    client.pay(&customer, &vendor, &20_000_000i128, &memo);

    let payments = client.get_vendor_payments(&vendor, &10u32, &0u32);
    assert_eq!(payments.len(), 2);
}

#[test]
fn test_get_customer_payments() {
    let (env, client, token) = setup_initialized();
    let customer = Address::generate(&env);
    let other_customer = Address::generate(&env);
    let vendor = Address::generate(&env);
    mint_to(&env, &token, &customer, 1_000_000_000i128);
    mint_to(&env, &token, &other_customer, 1_000_000_000i128);
    let memo = String::from_str(&env, "fish");

    client.pay(&customer, &vendor, &10_000_000i128, &memo);
    client.pay(&other_customer, &vendor, &20_000_000i128, &memo);
    client.pay(&customer, &vendor, &30_000_000i128, &memo);

    let payments = client.get_customer_payments(&customer, &10u32, &0u32);
    assert_eq!(payments.len(), 2);
    assert_eq!(payments.get(0).unwrap().amount, 10_000_000i128);
    assert_eq!(payments.get(1).unwrap().amount, 30_000_000i128);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_zero_amount_panics() {
    let (env, client) = setup();
    let customer = Address::generate(&env);
    let vendor = Address::generate(&env);
    let memo = String::from_str(&env, "test");
    client.pay(&customer, &vendor, &0i128, &memo);
}

#[test]
fn test_token_view_returns_init_token() {
    let (_, client, token) = setup_initialized();
    assert_eq!(client.token(), token);
}

#[test]
fn test_set_token_admin_swaps() {
    let (env, client, _) = setup_initialized();
    let admin_addr: Address = env.as_contract(&client.address, || {
        env.storage()
            .instance()
            .get(&soroban_sdk::symbol_short!("ADMIN"))
            .unwrap()
    });
    let token_admin = Address::generate(&env);
    let new_asset = env.register_stellar_asset_contract_v2(token_admin);
    let new_token = new_asset.address();
    client.set_token(&admin_addr, &new_token);
    assert_eq!(client.token(), new_token);
}

#[test]
#[should_panic(expected = "not admin")]
fn test_set_token_rejects_non_admin() {
    let (env, client, _) = setup_initialized();
    let attacker = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let new_asset = env.register_stellar_asset_contract_v2(token_admin);
    client.set_token(&attacker, &new_asset.address());
}

#[test]
fn test_pay_uses_new_token_after_set_token() {
    let (env, client, _) = setup_initialized();
    let admin_addr: Address = env.as_contract(&client.address, || {
        env.storage()
            .instance()
            .get(&soroban_sdk::symbol_short!("ADMIN"))
            .unwrap()
    });
    let token_admin = Address::generate(&env);
    let new_asset = env.register_stellar_asset_contract_v2(token_admin);
    let new_token = new_asset.address();
    client.set_token(&admin_addr, &new_token);

    let customer = Address::generate(&env);
    let vendor = Address::generate(&env);
    mint_to(&env, &new_token, &customer, 1_000_000_000i128);
    let memo = String::from_str(&env, "stablecoin payment");
    let id = client.pay(&customer, &vendor, &10_000_000i128, &memo);
    assert_eq!(id, 1);

    let new_token_client = soroban_sdk::token::TokenClient::new(&env, &new_token);
    assert_eq!(new_token_client.balance(&vendor), 10_000_000i128);
}
