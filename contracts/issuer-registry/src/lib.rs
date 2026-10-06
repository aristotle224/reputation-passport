/*!
# issuer-registry

Allowlist of platforms (issuers) permitted to write attestations to the
`attestation-registry`.  Tracks stake/bond amounts and issuer lifecycle status
(`active` / `suspended` / `delisted`).

## Issuer lifecycle

```text
 (unregistered) ──register_issuer──> Active
      Active     ──suspend_issuer──> Suspended
   Suspended     ──reactivate_issuer──> Active
      Active     ──delist_issuer──>  Delisted
   Suspended     ──delist_issuer──>  Delisted
```

`suspend_issuer` and `delist_issuer` are admin-gated (only the contract admin
can call them).  `register_issuer` and `reactivate_issuer` are callable by the
issuer address itself.

## Storage layout

| Key                          | Value          | Description                      |
|------------------------------|----------------|----------------------------------|
| `DataKey::Admin`             | `Address`      | Contract administrator           |
| `DataKey::Issuer(addr)`      | `IssuerRecord` | Per-issuer state                 |
| `DataKey::MinStake`          | `i128`         | Minimum stake in stroops         |

## Events

| Topic                    | Data                         | When                        |
|--------------------------|------------------------------|-----------------------------|
| `["issuer_registered"]`  | `{ issuer, stake }`          | New issuer registers        |
| `["issuer_suspended"]`   | `{ issuer }`                 | Admin suspends issuer       |
| `["issuer_reactivated"]` | `{ issuer }`                 | Issuer reactivates itself   |
| `["issuer_delisted"]`    | `{ issuer }`                 | Admin delists issuer        |
| `["stake_updated"]`      | `{ issuer, new_stake }`      | Issuer adds more stake      |
*/

#![no_std]

mod events;
mod storage;

use reputation_passport_shared::{Error, IssuerStatus};
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

pub use storage::IssuerRecord;

#[cfg(test)]
mod tests;

// ── Storage key enum ────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// Per-issuer state; keyed by the issuer's Stellar address.
    Issuer(Address),
    /// Minimum stake (in stroops) required to register as an issuer.
    MinStake,
}

// ── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct IssuerRegistryContract;

#[contractimpl]
impl IssuerRegistryContract {
    // ── Initialisation ───────────────────────────────────────────────────

    /// Initialise the contract, setting the admin address and the minimum
    /// stake amount (in stroops).  Must be called exactly once after
    /// deployment.  Subsequent calls will panic.
    pub fn initialize(env: Env, admin: Address, min_stake: i128) {
        // Prevent re-initialisation.
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::MinStake, &min_stake);
    }

    // ── Issuer write operations ──────────────────────────────────────────

    /// Register a new issuer.
    ///
    /// The `issuer` address must authorise this call.  The supplied `stake`
    /// must be ≥ the contract's `min_stake`.  Fails if the issuer is already
    /// registered.
    ///
    /// In a full implementation the stake would be transferred from the
    /// issuer's token balance; for the on-chain prototype we record the
    /// stated amount and rely on an off-chain bond mechanism — noted as a
    /// **Needs decision** item in `Plan.md`.
    pub fn register_issuer(env: Env, issuer: Address, stake: i128) -> Result<(), Error> {
        issuer.require_auth();

        let min_stake: i128 = env
            .storage()
            .instance()
            .get(&DataKey::MinStake)
            .unwrap_or(0);

        if stake < min_stake {
            return Err(Error::InsufficientStake);
        }

        let key = DataKey::Issuer(issuer.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::IssuerAlreadyRegistered);
        }

        let record = IssuerRecord {
            status: IssuerStatus::Active,
            stake,
            registered_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&key, &record);

        events::emit_registered(&env, &issuer, stake);
        Ok(())
    }

    /// Add more stake to an existing, non-delisted issuer account.
    ///
    /// The `issuer` address must authorise this call.
    pub fn add_stake(env: Env, issuer: Address, additional_stake: i128) -> Result<(), Error> {
        issuer.require_auth();

        let key = DataKey::Issuer(issuer.clone());
        let mut record: IssuerRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::IssuerNotFound)?;

        if record.status == IssuerStatus::Delisted {
            return Err(Error::IssuerDelisted);
        }

        record.stake = record.stake.saturating_add(additional_stake);
        env.storage().persistent().set(&key, &record);

        events::emit_stake_updated(&env, &issuer, record.stake);
        Ok(())
    }

    /// Reactivate a suspended issuer.
    ///
    /// The `issuer` address must authorise this call.  Only `Suspended`
    /// issuers can be reactivated; `Active` issuers are a no-op error,
    /// `Delisted` issuers cannot be reactivated.
    pub fn reactivate_issuer(env: Env, issuer: Address) -> Result<(), Error> {
        issuer.require_auth();

        let key = DataKey::Issuer(issuer.clone());
        let mut record: IssuerRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::IssuerNotFound)?;

        match record.status {
            IssuerStatus::Active => return Err(Error::IssuerNotFound), // already active — surface as not-found to avoid leaking state
            IssuerStatus::Delisted => return Err(Error::IssuerDelisted),
            IssuerStatus::Suspended => {}
        }

        record.status = IssuerStatus::Active;
        env.storage().persistent().set(&key, &record);

        events::emit_reactivated(&env, &issuer);
        Ok(())
    }

    // ── Admin-gated operations ───────────────────────────────────────────

    /// Suspend an active issuer.
    ///
    /// Requires admin authorization.  A suspended issuer's attestation writes
    /// will be rejected by `attestation-registry`.
    pub fn suspend_issuer(env: Env, issuer: Address) -> Result<(), Error> {
        Self::require_admin(&env)?;

        let key = DataKey::Issuer(issuer.clone());
        let mut record: IssuerRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::IssuerNotFound)?;

        if record.status == IssuerStatus::Delisted {
            return Err(Error::IssuerDelisted);
        }

        record.status = IssuerStatus::Suspended;
        env.storage().persistent().set(&key, &record);

        events::emit_suspended(&env, &issuer);
        Ok(())
    }

    /// Permanently delist an issuer.
    ///
    /// Requires admin authorization.  Delisting is terminal — the issuer
    /// cannot be reactivated through normal operations.  Existing attestations
    /// written by a delisted issuer remain on-chain (append-only principle)
    /// but their weight in scoring is a scoring-engine concern, not a contract
    /// concern.
    pub fn delist_issuer(env: Env, issuer: Address) -> Result<(), Error> {
        Self::require_admin(&env)?;

        let key = DataKey::Issuer(issuer.clone());
        let mut record: IssuerRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::IssuerNotFound)?;

        record.status = IssuerStatus::Delisted;
        env.storage().persistent().set(&key, &record);

        events::emit_delisted(&env, &issuer);
        Ok(())
    }

    // ── Read operations ──────────────────────────────────────────────────

    /// Return the full `IssuerRecord` for a registered issuer.
    pub fn get_issuer(env: Env, issuer: Address) -> Result<IssuerRecord, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Issuer(issuer))
            .ok_or(Error::IssuerNotFound)
    }

    /// Return just the status of a registered issuer.
    ///
    /// Convenience method used by `attestation-registry` for cross-contract
    /// status checks without deserialising the full record.
    pub fn get_issuer_status(env: Env, issuer: Address) -> Result<IssuerStatus, Error> {
        let record: IssuerRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Issuer(issuer))
            .ok_or(Error::IssuerNotFound)?;
        Ok(record.status)
    }

    /// Return the minimum stake required to register.
    pub fn get_min_stake(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::MinStake)
            .unwrap_or(0)
    }

    /// Return the admin address.
    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("contract not initialized")
    }

    // ── Internal helpers ─────────────────────────────────────────────────

    /// Require that the invoker is the contract admin.
    fn require_admin(env: &Env) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("contract not initialized");
        admin.require_auth();
        Ok(())
    }
}
