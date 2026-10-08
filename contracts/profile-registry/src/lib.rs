/*!
# profile-registry

Maps a worker's canonical identity to their Stellar address, supports key
rotation, and stores a metadata hash pointing to encrypted off-chain profile
data (name, categories, etc.) that the worker controls.

No PII lives on-chain — only hashes and pointers, per README.md's privacy
design principle.

## Worker lifecycle

```text
register_worker(worker, metadata_hash) → Worker record created
update_metadata(worker, new_hash)      → metadata_hash updated
rotate_key(old_key, new_key)           → record moved, old key removed
```

## Storage layout

| Key                     | Value     | Description              |
|-------------------------|-----------|--------------------------|
| `DataKey::Admin`        | `Address` | Contract administrator   |
| `DataKey::Worker(addr)` | `Worker`  | Per-worker profile record |

## Events

| Topics                            | Data              | When                      |
|-----------------------------------|-------------------|---------------------------|
| `["worker_registered"]`           | `{ worker }`      | Worker registers          |
| `["metadata_updated", worker]`    | `{ worker }`      | Metadata hash updated     |
| `["key_rotated"]`                 | `{ old_key, new_key }` | Key rotation      |
*/

#![no_std]

mod events;

use reputation_passport_shared::Error;
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env};

#[cfg(test)]
mod tests;

// ── Worker struct ─────────────────────────────────────────────────────────────

/// On-chain worker profile, exactly matching the README.md data model.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Worker {
    /// The worker's canonical Stellar address / identity.
    pub id: Address,
    /// Ledger timestamp when the profile was first created.
    pub created_at: u64,
    /// Hash of the off-chain profile data (encrypted, worker-controlled).
    /// The worker updates this when their off-chain data changes.
    pub metadata_hash: BytesN<32>,
}

// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Contract administrator address.
    Admin,
    /// Per-worker profile record, keyed by the worker's Stellar address.
    Worker(Address),
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct ProfileRegistryContract;

#[contractimpl]
impl ProfileRegistryContract {
    // ── Initialisation ────────────────────────────────────────────────────

    /// Initialise the contract with an admin address.
    /// Must be called exactly once after deployment.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    // ── Worker write operations ───────────────────────────────────────────

    /// Register a new worker profile.
    ///
    /// The `worker` address must authorise this call.
    /// Fails if a profile for this address already exists.
    pub fn register_worker(
        env: Env,
        worker: Address,
        metadata_hash: BytesN<32>,
    ) -> Result<(), Error> {
        worker.require_auth();

        let key = DataKey::Worker(worker.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::ProfileAlreadyExists);
        }

        let record = Worker {
            id: worker.clone(),
            created_at: env.ledger().timestamp(),
            metadata_hash,
        };
        env.storage().persistent().set(&key, &record);

        events::emit_registered(&env, &worker);
        Ok(())
    }

    /// Update the metadata hash for an existing worker profile.
    ///
    /// The `worker` address must authorise this call.
    /// Fails if no profile exists for this address.
    pub fn update_metadata(
        env: Env,
        worker: Address,
        metadata_hash: BytesN<32>,
    ) -> Result<(), Error> {
        worker.require_auth();

        let key = DataKey::Worker(worker.clone());
        let mut record: Worker = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::ProfileNotFound)?;

        record.metadata_hash = metadata_hash;
        env.storage().persistent().set(&key, &record);

        events::emit_metadata_updated(&env, &worker);
        Ok(())
    }

    /// Rotate the worker's key: move the profile to a new address and remove
    /// the old entry.
    ///
    /// The `old_key` address must authorise this call.
    /// Fails if no profile exists under `old_key`, or if `new_key` already
    /// has a profile.
    pub fn rotate_key(env: Env, old_key: Address, new_key: Address) -> Result<(), Error> {
        old_key.require_auth();

        let old_storage_key = DataKey::Worker(old_key.clone());
        let new_storage_key = DataKey::Worker(new_key.clone());

        if env.storage().persistent().has(&new_storage_key) {
            return Err(Error::ProfileAlreadyExists);
        }

        let mut record: Worker = env
            .storage()
            .persistent()
            .get(&old_storage_key)
            .ok_or(Error::ProfileNotFound)?;

        // Update the stored identity to the new address.
        record.id = new_key.clone();
        env.storage().persistent().set(&new_storage_key, &record);
        env.storage().persistent().remove(&old_storage_key);

        events::emit_key_rotated(&env, &old_key, &new_key);
        Ok(())
    }

    // ── Read operations ───────────────────────────────────────────────────

    /// Return the worker profile for the given address.
    pub fn get_worker(env: Env, worker: Address) -> Result<Worker, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Worker(worker))
            .ok_or(Error::ProfileNotFound)
    }

    /// Return the contract admin address.
    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("contract not initialized")
    }
}
