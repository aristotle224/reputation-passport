#![cfg(test)]

use soroban_sdk::{
    testutils::Address as _,
    Address, BytesN, Env,
};

use crate::{AttestationRegistryContract, AttestationRegistryContractClient};
use issuer_registry::{IssuerRegistryContract, IssuerRegistryContractClient};
use reputation_passport_shared::{Error, JobType};

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Deploy both contracts and initialise them.  Returns
/// `(attestation_client, issuer_client, admin, issuer_addr)`.
fn setup_env<'a>(
    env: &'a Env,
) -> (
    AttestationRegistryContractClient<'a>,
    IssuerRegistryContractClient<'a>,
    Address,
    Address,
) {
    let admin = Address::generate(env);
    let issuer = Address::generate(env);

    // Deploy issuer-registry.
    let ir_id = env.register(IssuerRegistryContract, ());
    let ir_client = IssuerRegistryContractClient::new(env, &ir_id);
    ir_client.initialize(&admin, &100_i128);

    // Deploy attestation-registry, pointing at issuer-registry.
    let ar_id = env.register(AttestationRegistryContract, ());
    let ar_client = AttestationRegistryContractClient::new(env, &ar_id);
    ar_client.initialize(&ir_id);

    (ar_client, ir_client, admin, issuer)
}

fn evidence() -> [u8; 32] {
    [0xabu8; 32]
}

fn evidence_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &evidence())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[test]
fn write_attestation_by_active_issuer_succeeds() {
    let env = Env::default();
    env.mock_all_auths();
    let (ar, ir, _admin, issuer) = setup_env(&env);

    let worker = Address::generate(&env);

    ir.register_issuer(&issuer, &200_i128);

    let nonce = ar.write_attestation(
        &issuer,
        &worker,
        &JobType::Delivery,
        &480_u32,
        &1_u32,
        &evidence_hash(&env),
    );
    assert_eq!(nonce, 0);

    let att = ar.get_attestation(&worker, &issuer, &0_u64);
    assert_eq!(att.rating, 480);
    assert_eq!(att.weight, 1);
    assert!(!att.revoked);
}

#[test]
fn write_increments_nonce() {
    let env = Env::default();
    env.mock_all_auths();
    let (ar, ir, _admin, issuer) = setup_env(&env);
    let worker = Address::generate(&env);

    ir.register_issuer(&issuer, &200_i128);

    let n0 = ar.write_attestation(&issuer, &worker, &JobType::Delivery, &300, &1, &evidence_hash(&env));
    let n1 = ar.write_attestation(&issuer, &worker, &JobType::Rideshare, &400, &2, &evidence_hash(&env));
    assert_eq!(n0, 0);
    assert_eq!(n1, 1);
    assert_eq!(ar.get_attestation_count(&worker), 2);
}

#[test]
fn write_by_unregistered_issuer_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (ar, _ir, _admin, issuer) = setup_env(&env);
    let worker = Address::generate(&env);

    let result = ar.try_write_attestation(
        &issuer,
        &worker,
        &JobType::Delivery,
        &480,
        &1,
        &evidence_hash(&env),
    );
    assert!(result.is_err());
}

#[test]
fn write_by_suspended_issuer_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (ar, ir, admin, issuer) = setup_env(&env);
    let worker = Address::generate(&env);

    ir.register_issuer(&issuer, &200_i128);
    ir.suspend_issuer(&issuer);

    let result = ar.try_write_attestation(
        &issuer,
        &worker,
        &JobType::Delivery,
        &480,
        &1,
        &evidence_hash(&env),
    );
    assert_eq!(
        result.unwrap_err().unwrap(),
        Error::IssuerSuspended
    );
}

#[test]
fn write_by_delisted_issuer_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (ar, ir, admin, issuer) = setup_env(&env);
    let worker = Address::generate(&env);

    ir.register_issuer(&issuer, &200_i128);
    ir.delist_issuer(&issuer);

    let result = ar.try_write_attestation(
        &issuer,
        &worker,
        &JobType::Delivery,
        &480,
        &1,
        &evidence_hash(&env),
    );
    assert_eq!(
        result.unwrap_err().unwrap(),
        Error::IssuerDelisted
    );
}

#[test]
fn invalid_rating_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (ar, ir, _admin, issuer) = setup_env(&env);
    let worker = Address::generate(&env);

    ir.register_issuer(&issuer, &200_i128);

    let result = ar.try_write_attestation(
        &issuer,
        &worker,
        &JobType::Delivery,
        &501, // > 500
        &1,
        &evidence_hash(&env),
    );
    assert_eq!(result.unwrap_err().unwrap(), Error::InvalidRating);
}

#[test]
fn zero_weight_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (ar, ir, _admin, issuer) = setup_env(&env);
    let worker = Address::generate(&env);

    ir.register_issuer(&issuer, &200_i128);

    let result = ar.try_write_attestation(
        &issuer,
        &worker,
        &JobType::Delivery,
        &480,
        &0, // weight = 0
        &evidence_hash(&env),
    );
    assert_eq!(result.unwrap_err().unwrap(), Error::InvalidWeight);
}

#[test]
fn revoke_sets_flag() {
    let env = Env::default();
    env.mock_all_auths();
    let (ar, ir, _admin, issuer) = setup_env(&env);
    let worker = Address::generate(&env);

    ir.register_issuer(&issuer, &200_i128);
    ar.write_attestation(&issuer, &worker, &JobType::Delivery, &480, &1, &evidence_hash(&env));

    ar.revoke_attestation(&issuer, &worker, &0_u64);

    let att = ar.get_attestation(&worker, &issuer, &0_u64);
    assert!(att.revoked);
}

#[test]
fn double_revoke_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (ar, ir, _admin, issuer) = setup_env(&env);
    let worker = Address::generate(&env);

    ir.register_issuer(&issuer, &200_i128);
    ar.write_attestation(&issuer, &worker, &JobType::Delivery, &480, &1, &evidence_hash(&env));
    ar.revoke_attestation(&issuer, &worker, &0_u64);

    let result = ar.try_revoke_attestation(&issuer, &worker, &0_u64);
    assert_eq!(result.unwrap_err().unwrap(), Error::AlreadyRevoked);
}

#[test]
fn correction_flow_revoke_then_new_attestation() {
    let env = Env::default();
    env.mock_all_auths();
    let (ar, ir, _admin, issuer) = setup_env(&env);
    let worker = Address::generate(&env);

    ir.register_issuer(&issuer, &200_i128);

    // Original attestation
    let n0 = ar.write_attestation(&issuer, &worker, &JobType::Delivery, &300, &1, &evidence_hash(&env));
    assert_eq!(n0, 0);

    // Revoke it
    ar.revoke_attestation(&issuer, &worker, &n0);

    // Issue correction as a new attestation
    let n1 = ar.write_attestation(&issuer, &worker, &JobType::Delivery, &480, &1, &evidence_hash(&env));
    assert_eq!(n1, 1);

    // Both records exist; original is revoked, correction is not
    let original = ar.get_attestation(&worker, &issuer, &n0);
    let correction = ar.get_attestation(&worker, &issuer, &n1);
    assert!(original.revoked);
    assert!(!correction.revoked);
    assert_eq!(ar.get_attestation_count(&worker), 2);
}

#[test]
fn get_nonexistent_attestation_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (ar, _ir, _admin, _issuer) = setup_env(&env);
    let worker = Address::generate(&env);

    let result = ar.try_get_attestation(&worker, &Address::generate(&env), &99_u64);
    assert_eq!(result.unwrap_err().unwrap(), Error::AttestationNotFound);
}

#[test]
fn attestation_count_zero_for_unknown_subject() {
    let env = Env::default();
    env.mock_all_auths();
    let (ar, _ir, _admin, _issuer) = setup_env(&env);
    let worker = Address::generate(&env);
    assert_eq!(ar.get_attestation_count(&worker), 0);
}
