/*!
Contract events for issuer-registry.

Each event type is defined as a struct annotated with `#[contractevent]`,
which is the soroban-sdk 28 pattern. Fields marked `#[topic]` appear in the
event topics list (indexed by the Soroban event system); unmarked fields
appear in the event data payload.

The indexer (`backend/src/indexer`) subscribes to events by topic; keep topic
names stable and document any change as a breaking change.
*/

use soroban_sdk::{contractevent, Address, Env};

// ── IssuerRegistered ──────────────────────────────────────────────────────────

/// Emitted when a new platform successfully registers as an issuer.
#[contractevent(topics = ["issuer_registered"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IssuerRegistered {
    /// The address of the newly registered issuer.
    #[topic]
    pub issuer: Address,
    /// The stake amount recorded at registration time.
    pub stake: i128,
}

// ── IssuerSuspended ───────────────────────────────────────────────────────────

/// Emitted when an admin suspends an active issuer.
#[contractevent(topics = ["issuer_suspended"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IssuerSuspended {
    #[topic]
    pub issuer: Address,
}

// ── IssuerReactivated ─────────────────────────────────────────────────────────

/// Emitted when a suspended issuer reactivates itself.
#[contractevent(topics = ["issuer_reactivated"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IssuerReactivated {
    #[topic]
    pub issuer: Address,
}

// ── IssuerDelisted ────────────────────────────────────────────────────────────

/// Emitted when an admin permanently delists an issuer.
#[contractevent(topics = ["issuer_delisted"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IssuerDelisted {
    #[topic]
    pub issuer: Address,
}

// ── StakeUpdated ──────────────────────────────────────────────────────────────

/// Emitted when an issuer increases their stake.
#[contractevent(topics = ["stake_updated"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StakeUpdated {
    #[topic]
    pub issuer: Address,
    /// Running total stake after the addition.
    pub new_stake: i128,
}

// ── Emit helpers ─────────────────────────────────────────────────────────────

pub fn emit_registered(env: &Env, issuer: &Address, stake: i128) {
    IssuerRegistered {
        issuer: issuer.clone(),
        stake,
    }
    .publish(env);
}

pub fn emit_suspended(env: &Env, issuer: &Address) {
    IssuerSuspended {
        issuer: issuer.clone(),
    }
    .publish(env);
}

pub fn emit_reactivated(env: &Env, issuer: &Address) {
    IssuerReactivated {
        issuer: issuer.clone(),
    }
    .publish(env);
}

pub fn emit_delisted(env: &Env, issuer: &Address) {
    IssuerDelisted {
        issuer: issuer.clone(),
    }
    .publish(env);
}

pub fn emit_stake_updated(env: &Env, issuer: &Address, new_stake: i128) {
    StakeUpdated {
        issuer: issuer.clone(),
        new_stake,
    }
    .publish(env);
}
