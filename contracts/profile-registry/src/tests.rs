#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

use crate::{ProfileRegistryContract, ProfileRegistryContractClient};
use reputation_passport_shared::Error;

fn setup_env(env: &Env) -> (ProfileRegistryContractClient, Address) {
    let admin = Address::generate(env);
    let id = env.register(ProfileRegistryContract, ());
    let client = ProfileRegistryContractClient::new(env, &id);
    client.initialize(&admin);
    (client, admin)
}

fn meta(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0x01u8; 32])
}

fn meta2(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0x02u8; 32])
}

#[test]
fn register_and_get_worker() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup_env(&env);
    let worker = Address::generate(&env);

    client.register_worker(&worker, &meta(&env));

    let record = client.get_worker(&worker);
    assert_eq!(record.id, worker);
    assert_eq!(record.metadata_hash, meta(&env));
}

#[test]
fn double_register_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup_env(&env);
    let worker = Address::generate(&env);

    client.register_worker(&worker, &meta(&env));
    let result = client.try_register_worker(&worker, &meta(&env));
    assert_eq!(result.unwrap_err().unwrap(), Error::ProfileAlreadyExists);
}

#[test]
fn update_metadata() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup_env(&env);
    let worker = Address::generate(&env);

    client.register_worker(&worker, &meta(&env));
    client.update_metadata(&worker, &meta2(&env));

    let record = client.get_worker(&worker);
    assert_eq!(record.metadata_hash, meta2(&env));
}

#[test]
fn update_metadata_nonexistent_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup_env(&env);
    let worker = Address::generate(&env);

    let result = client.try_update_metadata(&worker, &meta(&env));
    assert_eq!(result.unwrap_err().unwrap(), Error::ProfileNotFound);
}

#[test]
fn rotate_key() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup_env(&env);
    let old_key = Address::generate(&env);
    let new_key = Address::generate(&env);

    client.register_worker(&old_key, &meta(&env));
    client.rotate_key(&old_key, &new_key);

    // new key has the profile
    let record = client.get_worker(&new_key);
    assert_eq!(record.id, new_key);

    // old key is gone
    let result = client.try_get_worker(&old_key);
    assert_eq!(result.unwrap_err().unwrap(), Error::ProfileNotFound);
}

#[test]
fn rotate_key_to_existing_address_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup_env(&env);
    let worker1 = Address::generate(&env);
    let worker2 = Address::generate(&env);

    client.register_worker(&worker1, &meta(&env));
    client.register_worker(&worker2, &meta2(&env));

    let result = client.try_rotate_key(&worker1, &worker2);
    assert_eq!(result.unwrap_err().unwrap(), Error::ProfileAlreadyExists);
}

#[test]
fn rotate_key_nonexistent_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup_env(&env);
    let old_key = Address::generate(&env);
    let new_key = Address::generate(&env);

    let result = client.try_rotate_key(&old_key, &new_key);
    assert_eq!(result.unwrap_err().unwrap(), Error::ProfileNotFound);
}

#[test]
fn get_nonexistent_worker_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin) = setup_env(&env);
    let worker = Address::generate(&env);

    let result = client.try_get_worker(&worker);
    assert_eq!(result.unwrap_err().unwrap(), Error::ProfileNotFound);
}
