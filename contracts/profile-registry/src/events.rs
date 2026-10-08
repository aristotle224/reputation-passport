/*!
Contract events for profile-registry.
*/

use soroban_sdk::{contractevent, Address, Env};

// ── WorkerRegistered ──────────────────────────────────────────────────────────

#[contractevent(topics = ["worker_registered"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorkerRegistered {
    #[topic]
    pub worker: Address,
}

// ── MetadataUpdated ───────────────────────────────────────────────────────────

#[contractevent(topics = ["metadata_updated"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MetadataUpdated {
    #[topic]
    pub worker: Address,
}

// ── KeyRotated ────────────────────────────────────────────────────────────────

#[contractevent(topics = ["key_rotated"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KeyRotated {
    #[topic]
    pub old_key: Address,
    pub new_key: Address,
}

// ── Emit helpers ──────────────────────────────────────────────────────────────

pub fn emit_registered(env: &Env, worker: &Address) {
    WorkerRegistered {
        worker: worker.clone(),
    }
    .publish(env);
}

pub fn emit_metadata_updated(env: &Env, worker: &Address) {
    MetadataUpdated {
        worker: worker.clone(),
    }
    .publish(env);
}

pub fn emit_key_rotated(env: &Env, old_key: &Address, new_key: &Address) {
    KeyRotated {
        old_key: old_key.clone(),
        new_key: new_key.clone(),
    }
    .publish(env);
}
