# Data Model

This document describes the on-chain storage layout for all three contracts,
and the Postgres schema used by the backend indexer.

---

## On-chain structs

### Worker (`profile-registry`)

```rust
struct Worker {
    id: Address,            // Stellar account or dedicated identity contract
    created_at: u64,        // ledger timestamp (Unix seconds)
    metadata_hash: BytesN<32>, // hash of off-chain encrypted profile data
}
```

Storage key: `DataKey::Worker(address)`.

No PII is stored on-chain — `metadata_hash` is a pointer to encrypted
off-chain data the worker controls access to.

### Issuer (`issuer-registry`)

```rust
struct IssuerInfo {
    address: Address,
    stake: i128,            // XLM stake in stroops
    status: IssuerStatus,   // Active | Suspended | Delisted
    registered_at: u64,
}
```

Storage key: `DataKey::Issuer(address)`.

### Attestation (`attestation-registry`)

```rust
struct Attestation {
    issuer: Address,
    subject: Address,
    job_type: JobType,      // Delivery | Rideshare | FreelanceDev | Other
    rating: u32,            // 0–500 (500 = 5.0 stars)
    weight: u32,            // job value/duration, used in weighted scoring
    timestamp: u64,         // ledger timestamp (Unix seconds)
    evidence_hash: BytesN<32>, // IPFS/Arweave content hash (off-chain proof)
    revoked: bool,
}
```

Storage key: `DataKey::Attestation(subject, issuer, nonce)`.

Attestations are never mutated. A correction is:
1. A new `write_attestation` call creating a fresh record.
2. A `revoke_attestation` call on the original, setting `revoked = true`.

This preserves full audit history per README.md's "no silent rewrite" guarantee.

---

## On-chain events

### `AttestationWritten`

Emitted by `attestation-registry` on every successful write.

```
topic[0]: Symbol("attestation_written")
topic[1]: Address(subject)
data: Map {
  issuer:    Address,
  nonce:     u64,
  job_type:  Enum(JobType),
  rating:    u32,
  weight:    u32,
  timestamp: u64,
}
```

The indexer subscribes to this event; the SDK's `parseAttestationWrittenEvent()`
parses it into a typed `AttestationWrittenEvent`.

### `IssuerRegistered`

Emitted by `issuer-registry` on successful registration.

```
topic[0]: Symbol("issuer_registered")
topic[1]: Address(issuer)
data: Map {
  stake: i128,
}
```

---

## Postgres schema

Managed by `backend/src/database/migrations/001_initial_schema.sql`.

### `attestations`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | Internal row ID |
| `issuer_address` | TEXT NOT NULL | Stellar G-address |
| `subject_address` | TEXT NOT NULL | Stellar G-address |
| `nonce` | BIGINT NOT NULL | On-chain nonce |
| `job_type` | TEXT NOT NULL | `delivery` / `rideshare` / `freelance-dev` / `other` |
| `rating` | INTEGER NOT NULL | 0–500 |
| `weight` | INTEGER NOT NULL | Positive integer |
| `timestamp` | BIGINT NOT NULL | Unix seconds |
| `evidence_hash` | TEXT | Hex-encoded 32-byte hash |
| `revoked` | BOOLEAN NOT NULL DEFAULT false | |
| `ledger_sequence` | BIGINT | Ledger at which event was observed |
| `created_at` | TIMESTAMPTZ DEFAULT now() | Row insertion time |

Unique constraint: `(issuer_address, subject_address, nonce)`.

Index: `subject_address` (for worker profile lookups).

### `issuers`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `issuer_address` | TEXT UNIQUE NOT NULL | |
| `stake` | BIGINT | Stake in stroops |
| `status` | TEXT NOT NULL DEFAULT 'Active' | |
| `registered_at` | BIGINT | Unix seconds |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

### `workers`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `worker_address` | TEXT UNIQUE NOT NULL | |
| `metadata_hash` | TEXT | Hex-encoded 32-byte hash |
| `registered_at` | BIGINT | Unix seconds |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

---

## JobType taxonomy

| On-chain variant | SDK / API string | Description |
|---|---|---|
| `Delivery` | `delivery` | Package/food delivery |
| `Rideshare` | `rideshare` | Passenger transport |
| `FreelanceDev` | `freelance-dev` | Software development work |
| `Other` | `other` | Uncategorized / future categories |

Cross-platform rating semantics are an open design decision — see
`docs/taxonomy.md` and README.md's "Open design decisions" section.
