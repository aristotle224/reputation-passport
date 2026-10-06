/*!
# reputation-passport-shared

Common types, error codes, and test utilities shared across all three
reputation-passport contracts (`issuer-registry`, `attestation-registry`,
`profile-registry`).

Nothing in this crate contains scoring logic or off-chain concerns — it is
purely the on-chain type vocabulary.
*/

#![no_std]

mod errors;
mod types;

pub use errors::Error;
pub use types::{IssuerStatus, JobType};
