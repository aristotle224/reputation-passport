/*!
Contract events for attestation-registry.

The indexer (`backend/src/indexer`) subscribes to these events by topic —
keep topic names stable and treat any change as a breaking change.
*/

use reputation_passport_shared::JobType;
use soroban_sdk::{contractevent, Address, Env};

// ── AttestationWritten ────────────────────────────────────────────────────────

/// Emitted on every successful `write_attestation` call.
/// The indexer depends on this event to mirror records into Postgres.
#[contractevent(topics = ["attestation_written"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AttestationWritten {
    /// Worker address — indexed as a topic for efficient filtering.
    #[topic]
    pub subject: Address,
    /// The platform that issued this attestation.
    pub issuer: Address,
    /// Nonce assigned to this attestation (key component for direct lookup).
    pub nonce: u64,
    /// Normalized job type.
    pub job_type: JobType,
    /// Rating on the 0–500 scale.
    pub rating: u32,
    /// Job weight used in scoring.
    pub weight: u32,
    /// Ledger timestamp at write time.
    pub timestamp: u64,
}

// ── AttestationRevoked ────────────────────────────────────────────────────────

/// Emitted when an issuer revokes one of their attestations.
#[contractevent(topics = ["attestation_revoked"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AttestationRevoked {
    /// Worker address.
    #[topic]
    pub subject: Address,
    /// The issuer that is revoking.
    pub issuer: Address,
    /// Nonce of the revoked attestation.
    pub nonce: u64,
}

// ── Emit helpers ──────────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
pub fn emit_written(
    env: &Env,
    issuer: &Address,
    subject: &Address,
    nonce: u64,
    job_type: &JobType,
    rating: u32,
    weight: u32,
    timestamp: u64,
) {
    AttestationWritten {
        subject: subject.clone(),
        issuer: issuer.clone(),
        nonce,
        job_type: job_type.clone(),
        rating,
        weight,
        timestamp,
    }
    .publish(env);
}

pub fn emit_revoked(env: &Env, issuer: &Address, subject: &Address, nonce: u64) {
    AttestationRevoked {
        subject: subject.clone(),
        issuer: issuer.clone(),
        nonce,
    }
    .publish(env);
}
