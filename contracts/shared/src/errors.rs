use soroban_sdk::contracterror;

/// Canonical error codes for all reputation-passport contracts.
///
/// Using a single, shared error enum means every contract in the workspace
/// surfaces the same numeric codes to callers, making error handling
/// predictable for SDK consumers.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    // ── Issuer errors (1xx) ──────────────────────────────────────────────
    /// Caller is not in the issuer registry (or is not active).
    IssuerNotFound = 100,
    /// The issuer address has already been registered.
    IssuerAlreadyRegistered = 101,
    /// Issuer stake/bond amount is below the required minimum.
    InsufficientStake = 102,
    /// Issuer is suspended and cannot perform write operations.
    IssuerSuspended = 103,
    /// Issuer has been delisted and cannot be reactivated through normal paths.
    IssuerDelisted = 104,

    // ── Attestation errors (2xx) ─────────────────────────────────────────
    /// Attestation record was not found for the given key.
    AttestationNotFound = 200,
    /// Rating value is outside the valid 0–500 range.
    InvalidRating = 201,
    /// Weight value must be greater than zero.
    InvalidWeight = 202,
    /// Attestation has already been revoked.
    AlreadyRevoked = 203,

    // ── Profile errors (3xx) ─────────────────────────────────────────────
    /// Worker profile was not found.
    ProfileNotFound = 300,
    /// Worker profile already exists; use an update call.
    ProfileAlreadyExists = 301,

    // ── Authorization errors (4xx) ───────────────────────────────────────
    /// Caller is not the contract admin.
    Unauthorized = 400,
    /// Caller does not own the profile being modified.
    NotProfileOwner = 401,
}
