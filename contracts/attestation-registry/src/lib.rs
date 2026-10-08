/*!
# attestation-registry

Append-only ledger of work attestations written by registered issuers about
workers. This contract is deliberately "dumb": no scoring logic runs here.
Every write emits an `AttestationWritten` event so the off-chain indexer
(`backend/src/indexer`) never has to full-scan contract state.

## Attestation lifecycle

```text
write_attestation(issuer, subject, ...) ─→ Attestation { revoked: false }
revoke_attestation(issuer, subject, nonce) ─→ sets revoked: true
correction = write_attestation(...) ─→ new Attestation with new nonce
```

Revocation sets a flag on the original record; corrections are new records.
This preserves full audit history per the append-only principle in README.md.

## Storage layout

| Key                                   | Value         | Description                          |
|---------------------------------------|---------------|--------------------------------------|
| `DataKey::IssuerRegistry`             | `Address`     | Address of the issuer-registry contract |
| `DataKey::Attestation(subject, issuer, nonce)` | `Attestation` | Individual attestation record |
| `DataKey::SubjectNonce(subject)`      | `u64`         | Next nonce for a given subject       |

## Events

| Topics                                    | Data                                         | When                    |
|-------------------------------------------|----------------------------------------------|-------------------------|
| `["attestation_written", subject]`        | `{ issuer, nonce, job_type, rating, weight, timestamp }` | Successful write |
| `["attestation_revoked", subject]`        | `{ issuer, nonce }`                          | Successful revocation   |
*/

#![no_std]

mod events;

use issuer_registry::IssuerRegistryContractClient;
use reputation_passport_shared::{Error, IssuerStatus, JobType};
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env};

#[cfg(test)]
mod tests;

// ── On-chain Attestation struct ──────────────────────────────────────────────

/// On-chain attestation record, exactly matching the README.md data model.
///
/// Keyed by `(subject, issuer, nonce)` — never mutated in place.
/// Corrections are issued as new attestations plus a revocation flag on
/// the original, preserving full audit history.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Attestation {
    /// The registered platform that issued this attestation.
    pub issuer: Address,
    /// The worker being attested.
    pub subject: Address,
    /// Normalized job type from the shared taxonomy.
    pub job_type: JobType,
    /// Normalized rating on the 0–500 scale (500 = 5 stars).
    pub rating: u32,
    /// Job weight (e.g. job value/duration) used in weighted scoring.
    pub weight: u32,
    /// Ledger timestamp at write time.
    pub timestamp: u64,
    /// IPFS/Arweave hash of off-chain evidence controlled by the worker.
    pub evidence_hash: BytesN<32>,
    /// True if this attestation has been revoked. Revocation does not delete
    /// the record — it sets this flag, preserving the audit trail.
    pub revoked: bool,
}

// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Address of the deployed issuer-registry contract.
    IssuerRegistry,
    /// Individual attestation, keyed by (subject, issuer, nonce).
    Attestation(Address, Address, u64),
    /// Per-subject write counter; the next attestation for `subject` gets
    /// this value as its nonce, then it is incremented.
    SubjectNonce(Address),
}

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct AttestationRegistryContract;

#[contractimpl]
impl AttestationRegistryContract {
    // ── Initialisation ────────────────────────────────────────────────────

    /// Initialise the contract with the address of the issuer-registry contract.
    /// Must be called exactly once after deployment.
    pub fn initialize(env: Env, issuer_registry: Address) {
        if env.storage().instance().has(&DataKey::IssuerRegistry) {
            panic!("already initialized");
        }
        env.storage()
            .instance()
            .set(&DataKey::IssuerRegistry, &issuer_registry);
    }

    // ── Write operations ──────────────────────────────────────────────────

    /// Write a new attestation for a worker.
    ///
    /// The `issuer` must:
    ///   - Authorise this call.
    ///   - Be registered and `Active` in the issuer-registry (cross-contract check).
    ///
    /// `rating` must be in the range 0–500; `weight` must be > 0.
    ///
    /// On success, emits `AttestationWritten` and returns the assigned nonce.
    pub fn write_attestation(
        env: Env,
        issuer: Address,
        subject: Address,
        job_type: JobType,
        rating: u32,
        weight: u32,
        evidence_hash: BytesN<32>,
    ) -> Result<u64, Error> {
        issuer.require_auth();

        // Validate inputs before touching state.
        if rating > 500 {
            return Err(Error::InvalidRating);
        }
        if weight == 0 {
            return Err(Error::InvalidWeight);
        }

        // Cross-contract check: issuer must be Active.
        Self::require_active_issuer(&env, &issuer)?;

        // Assign nonce and increment counter.
        let nonce = Self::next_nonce(&env, &subject);

        let attestation = Attestation {
            issuer: issuer.clone(),
            subject: subject.clone(),
            job_type: job_type.clone(),
            rating,
            weight,
            timestamp: env.ledger().timestamp(),
            evidence_hash,
            revoked: false,
        };

        let key = DataKey::Attestation(subject.clone(), issuer.clone(), nonce);
        env.storage().persistent().set(&key, &attestation);

        events::emit_written(&env, &issuer, &subject, nonce, &job_type, rating, weight, attestation.timestamp);
        Ok(nonce)
    }

    /// Revoke an existing attestation.
    ///
    /// Only the original issuer may revoke their own attestation.
    /// Revocation sets `revoked = true`; the record remains on-chain.
    /// To issue a correction, write a new attestation *after* revoking the old one.
    pub fn revoke_attestation(
        env: Env,
        issuer: Address,
        subject: Address,
        nonce: u64,
    ) -> Result<(), Error> {
        issuer.require_auth();

        let key = DataKey::Attestation(subject.clone(), issuer.clone(), nonce);
        let mut attestation: Attestation = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::AttestationNotFound)?;

        if attestation.revoked {
            return Err(Error::AlreadyRevoked);
        }

        attestation.revoked = true;
        env.storage().persistent().set(&key, &attestation);

        events::emit_revoked(&env, &issuer, &subject, nonce);
        Ok(())
    }

    // ── Read operations ───────────────────────────────────────────────────

    /// Return the attestation for the given `(subject, issuer, nonce)` key.
    pub fn get_attestation(
        env: Env,
        subject: Address,
        issuer: Address,
        nonce: u64,
    ) -> Result<Attestation, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Attestation(subject, issuer, nonce))
            .ok_or(Error::AttestationNotFound)
    }

    /// Return the total number of attestations ever written for a given subject.
    ///
    /// This equals the next nonce that will be assigned (i.e. nonces are 0-indexed).
    /// Includes revoked attestations — revocation does not reduce the count.
    pub fn get_attestation_count(env: Env, subject: Address) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::SubjectNonce(subject))
            .unwrap_or(0)
    }

    /// Return the address of the issuer-registry contract this instance is
    /// configured to check.
    pub fn get_issuer_registry(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::IssuerRegistry)
            .expect("contract not initialized")
    }

    // ── Internal helpers ──────────────────────────────────────────────────

    /// Verify the issuer is Active in the issuer-registry via cross-contract call.
    fn require_active_issuer(env: &Env, issuer: &Address) -> Result<(), Error> {
        let registry_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::IssuerRegistry)
            .expect("contract not initialized");

        let client = IssuerRegistryContractClient::new(env, &registry_id);
        let status = client.get_issuer_status(issuer);

        match status {
            IssuerStatus::Active => Ok(()),
            IssuerStatus::Suspended => Err(Error::IssuerSuspended),
            IssuerStatus::Delisted => Err(Error::IssuerDelisted),
        }
    }

    /// Read the current nonce for a subject and increment it atomically.
    fn next_nonce(env: &Env, subject: &Address) -> u64 {
        let key = DataKey::SubjectNonce(subject.clone());
        let current: u64 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(current + 1));
        current
    }
}
