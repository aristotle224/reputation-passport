use soroban_sdk::contracttype;

/// Lifecycle status of a registered issuer (platform).
///
/// Transitions:
///
/// ```text
///  (not registered) ──register──> Active
///       Active       ──suspend──> Suspended
///     Suspended      ──reactivate──> Active
///       Active       ──delist──>  Delisted
///     Suspended      ──delist──>  Delisted
///   Delisted is terminal — no transition out via normal operations.
/// ```
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum IssuerStatus {
    Active,
    Suspended,
    Delisted,
}

/// Normalized job-type taxonomy shared by the attestation-registry and the
/// off-chain scoring engine.  The full vocabulary is documented in
/// `docs/taxonomy.md`; this enum covers the initial set named in README.md.
///
/// Represented as a `contracttype` so it can be stored / returned in XDR
/// without stringly-typed `Symbol` comparisons throughout the contract.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum JobType {
    Delivery,
    Rideshare,
    FreelanceDev,
    /// Escape hatch for job types not yet in the taxonomy.  The `Symbol` is
    /// a short, platform-defined string (≤32 bytes) that the scoring engine
    /// can bucket into "other" until a formal taxonomy entry is created.
    Other,
}
