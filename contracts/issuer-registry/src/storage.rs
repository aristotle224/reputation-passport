use reputation_passport_shared::IssuerStatus;
use soroban_sdk::contracttype;

/// Persistent on-chain record for a registered issuer.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IssuerRecord {
    /// Current lifecycle status.
    pub status: IssuerStatus,
    /// Recorded stake amount in stroops.
    ///
    /// **Needs decision:** actual token transfer vs. off-chain bond.  Current
    /// implementation records the stated amount; a production deployment
    /// should integrate with a Stellar token contract to hold the stake.
    pub stake: i128,
    /// Ledger timestamp at registration time.
    pub registered_at: u64,
}
