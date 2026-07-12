#![cfg(test)]

use crate::types::Error;
use crate::{PamanaOracle, PamanaOracleClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, BytesN, Env};

struct Setup<'a> {
    env: Env,
    admin: Address,
    appraiser: Address,
    asset: Address,
    oracle: PamanaOracleClient<'a>,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let appraiser = Address::generate(&env);
    let asset = Address::generate(&env);

    let id = env.register(PamanaOracle, ());
    let oracle = PamanaOracleClient::new(&env, &id);
    oracle.init(&admin);

    Setup {
        env,
        admin,
        appraiser,
        asset,
        oracle,
    }
}

#[test]
fn init_sets_admin_and_empty_appraisers() {
    let s = setup();
    assert_eq!(s.oracle.get_admin(), Some(s.admin.clone()));
    assert_eq!(s.oracle.get_appraisers().len(), 0);
}

#[test]
fn init_twice_fails() {
    let s = setup();
    let res = s.oracle.try_init(&s.admin);
    assert_eq!(res, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn add_appraiser_then_attest_and_read() {
    let s = setup();
    s.oracle.add_appraiser(&s.appraiser);
    assert!(s.oracle.is_appraiser(&s.appraiser));

    let doc = BytesN::from_array(&s.env, &[7u8; 32]);
    s.oracle.attest(&s.appraiser, &s.asset, &2_400_000i128, &doc);

    let att = s.oracle.get_attestation(&s.asset);
    assert_eq!(att.value_php, 2_400_000);
    assert_eq!(att.appraiser, s.appraiser);
    assert_eq!(att.doc_hash, doc);
}

#[test]
fn attest_by_non_appraiser_fails() {
    let s = setup();
    let doc = BytesN::from_array(&s.env, &[1u8; 32]);
    let res = s.oracle.try_attest(&s.appraiser, &s.asset, &1_000i128, &doc);
    assert_eq!(res, Err(Ok(Error::NotAppraiser)));
}

#[test]
fn attest_non_positive_value_fails() {
    let s = setup();
    s.oracle.add_appraiser(&s.appraiser);
    let doc = BytesN::from_array(&s.env, &[1u8; 32]);
    let res = s.oracle.try_attest(&s.appraiser, &s.asset, &0i128, &doc);
    assert_eq!(res, Err(Ok(Error::InvalidValue)));
}

#[test]
fn get_missing_attestation_fails() {
    let s = setup();
    let res = s.oracle.try_get_attestation(&s.asset);
    assert_eq!(res, Err(Ok(Error::NoAttestation)));
}

#[test]
fn duplicate_appraiser_fails() {
    let s = setup();
    s.oracle.add_appraiser(&s.appraiser);
    let res = s.oracle.try_add_appraiser(&s.appraiser);
    assert_eq!(res, Err(Ok(Error::AlreadyAppraiser)));
}

#[test]
fn remove_appraiser_blocks_attest() {
    let s = setup();
    s.oracle.add_appraiser(&s.appraiser);
    s.oracle.remove_appraiser(&s.appraiser);
    assert!(!s.oracle.is_appraiser(&s.appraiser));

    let doc = BytesN::from_array(&s.env, &[2u8; 32]);
    let res = s.oracle.try_attest(&s.appraiser, &s.asset, &1_000i128, &doc);
    assert_eq!(res, Err(Ok(Error::NotAppraiser)));
}

#[test]
fn attest_overwrites_prior() {
    let s = setup();
    s.oracle.add_appraiser(&s.appraiser);
    let doc1 = BytesN::from_array(&s.env, &[3u8; 32]);
    let doc2 = BytesN::from_array(&s.env, &[9u8; 32]);
    s.oracle.attest(&s.appraiser, &s.asset, &1_000_000i128, &doc1);
    s.oracle.attest(&s.appraiser, &s.asset, &2_000_000i128, &doc2);
    let att = s.oracle.get_attestation(&s.asset);
    assert_eq!(att.value_php, 2_000_000);
    assert_eq!(att.doc_hash, doc2);
}
