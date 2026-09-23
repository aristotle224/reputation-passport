# reputation-passport

Gig workers today rebuild their reputation from zero every time they join a new platform. Ratings, completed jobs, and history are siloed inside each platform's database and disappear the moment the worker moves on. **reputation-passport** turns that history into a set of on-chain attestations that any participating platform can write to, read from, and independently verify — without trusting a central authority to hold the data hostage.

---

## Table of Contents

- [Why this exists](#why-this-exists)
- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [Tech stack](#tech-stack)
- [Data model](#data-model)
- [Contracts](#contracts)
- [SDK](#sdk)
- [Backend (indexer + scoring API)](#backend-indexer--scoring-api)
- [Frontend (reference UI)](#frontend-reference-ui)
- [Getting started](#getting-started)
- [Trust & security model](#trust--security-model)
- [Open design decisions](#open-design-decisions)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Why this exists

Delivery, rideshare, and freelance platforms each maintain their own closed reputation system. A courier with 10,000 completed deliveries and a 4.9-star rating on one app starts a competing app with **nothing**. This is bad for workers (lost leverage, lost income during the ramp-up period) and bad for platforms (higher fraud risk from unverifiable newcomers, no shared signal to screen against).

**reputation-passport** provides a neutral, platform-agnostic ledger of work history that:

- Workers **own** (tied to their own wallet/identity, portable across every platform).
- Platforms **write to** (as an authenticated, registered issuer) and **read from** (to make onboarding/trust decisions).
- Nobody can silently rewrite or delete (append-only, on-chain, publicly auditable).
- Doesn't require workers to trust *any single platform* — or trust reputation-passport itself — since every derived score can be recomputed and checked against raw on-chain facts.

---

## How it works

1. A platform (an **Issuer**) registers with the protocol and stakes/bonds a small amount, establishing accountability.
2. When a worker completes a job, the issuing platform writes an **Attestation** — a small, structured record (job type, rating, weight, timestamp, evidence hash) — to the worker's on-chain profile.
3. Raw attestations are the on-chain source of truth. No scoring logic runs on-chain — it's too expensive and too rigid to iterate on.
4. An off-chain **indexer** listens to contract events and mirrors them into a queryable database.
5. A **scoring engine** computes a composite reputation score (weighted, time-decayed, category-aware) from the indexed attestations. The scoring formula is versioned and public, so any platform can recompute it independently rather than blindly trusting our number.
6. Other platforms query the worker's profile — via our API/SDK or directly from the chain — before onboarding them, instantly seeing verified history instead of starting from zero.

---

## Architecture

```
                     ┌─────────────────────────┐
                     │   Soroban Contracts      │
                     │  (Stellar testnet/mainnet)│
                     │                          │
                     │  IssuerRegistry          │
                     │  AttestationRegistry     │
                     │  ProfileRegistry         │
                     └────────────┬─────────────┘
                                  │ events (AttestationWritten, IssuerRegistered, ...)
                                  ▼
                     ┌─────────────────────────┐
                     │   NestJS Backend         │
                     │                          │
                     │  Indexer  → Postgres     │
                     │  Scoring Engine          │
                     │  Issuer API (auth)       │
                     │  Verification API        │
                     │  Fee-sponsorship service │
                     └────────────┬─────────────┘
                                  │ REST / GraphQL
                     ┌────────────┴─────────────┐
                     ▼                           ▼
        ┌───────────────────────┐   ┌───────────────────────────┐
        │   TypeScript SDK       │   │   Angular Reference UI     │
        │  (primary integration  │   │  Worker dashboard          │
        │   surface for partner  │   │  Issuer console             │
        │   platforms)           │   │  Public profile / widget    │
        └───────────────────────┘   └───────────────────────────┘
```

**Design principle:** the contract is the source of truth, the SDK is the primary integration surface (most platforms will never touch the UI), and the backend exists to make querying and scoring practical without putting that cost on-chain.

---

## Repository structure

```
reputation-passport/
├── contracts/                  # Soroban smart contracts (Rust)
│   ├── issuer-registry/
│   ├── attestation-registry/
│   ├── profile-registry/
│   └── shared/                 # shared types, error codes, test utils
├── sdk/
│   ├── ts/                     # @reputation-passport/sdk (issuer + read client)
│   └── widget/                 # lightweight browser-safe read-only client
├── backend/
│   ├── src/
│   │   ├── indexer/            # Soroban RPC event subscriber
│   │   ├── scoring/            # scoring engine, versioned algorithms
│   │   ├── issuer-api/         # authenticated write endpoints
│   │   ├── verification-api/   # public read + proof endpoints
│   │   └── sponsorship/        # fee-bump transaction service
│   └── test/
├── frontend/
│   ├── worker-dashboard/       # Angular app
│   ├── issuer-console/         # Angular app (or shared app, gated by role)
│   └── embeddable-widget/      # drop-in reputation badge
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── scoring-spec.md
│   └── taxonomy.md             # shared job-type / rating ontology
├── docker-compose.yml
└── README.md
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Smart contracts | Rust, Soroban SDK, Stellar (testnet → mainnet) |
| Backend | NestJS, TypeScript, PostgreSQL, Redis (caching/queues), Soroban RPC |
| SDK | TypeScript, `stellar-sdk` / `soroban-client` |
| Frontend | Angular, TypeScript, Freighter/Albedo wallet integration |
| Infra | Docker Compose (local), CI via GitHub Actions |

---

## Data model

### Worker profile
```rust
struct Worker {
    id: Address,                // Stellar account or dedicated identity contract
    created_at: u64,
    metadata_hash: BytesN<32>,  // hash of off-chain profile data (name, categories, etc.)
}
```

### Attestation
```rust
struct Attestation {
    issuer: Address,            // registered platform
    subject: Address,           // worker
    job_type: Symbol,           // "delivery" | "rideshare" | "freelance-dev" | ...
    rating: u32,                // normalized 0–500 scale
    weight: u32,                // e.g. job value/duration, used in weighted scoring
    timestamp: u64,
    evidence_hash: BytesN<32>,  // pointer to off-chain proof (IPFS/Arweave)
    revoked: bool,
}
```

Attestations are stored keyed by `(subject, issuer, nonce)` and never mutated in place — corrections are issued as new attestations plus a revocation flag on the original, preserving full audit history.

**No PII lives on-chain.** Only hashes and pointers to encrypted off-chain storage the worker controls access to (selective disclosure).

---

## Contracts

Three focused contracts instead of one monolith:

- **`issuer-registry`** — allowlist of platforms permitted to write attestations, tracks stake/bond and status (`active` / `suspended` / `delisted`). This is the primary Sybil/spam defense on the issuer side.
- **`attestation-registry`** — the append-only write/read logic. Deliberately "dumb": no scoring, minimal validation, emits an event on every write so the indexer never has to full-scan state.
- **`profile-registry`** — maps a worker's canonical identity to their Stellar address, supports key rotation, stores the metadata hash.

See [`docs/data-model.md`](docs/data-model.md) for the full storage layout and [`contracts/`](contracts/) for implementation and tests.

---

## SDK

The SDK is the **primary integration surface** — most partner platforms will never touch the UI. It wraps XDR construction, signing, RPC submission, event parsing, and the backend's scoring API behind a small, typed interface.

```ts
import { ReputationClient } from '@reputation-passport/sdk';

const client = new ReputationClient({ network: 'testnet', issuerKey: myIssuerKey });

// Write an attestation after a job completes
await client.attest({
  subject: workerAddress,
  jobType: 'delivery',
  rating: 480,       // 0–500 scale
  weight: 1,
  evidenceHash: hash,
});

// Read a worker's portable profile
const profile = await client.getProfile(workerAddress);
// { score: 4.6, breakdown: { delivery: 4.8, rideshare: 4.2 }, attestationCount: 132 }
```

Two packages:

- **`sdk/ts`** — full issuer SDK (Node/server-side): signing, fee-bump sponsorship, write + read.
- **`sdk/widget`** — read-only, browser-safe client for embeddable reputation badges. No wallet or signing required.

---

## Backend (indexer + scoring API)

- **Indexer** — subscribes to Soroban RPC `getEvents`, mirrors `AttestationWritten` / `IssuerRegistered` events into Postgres. Never scans full contract state.
- **Scoring engine** — computes composite reputation (weighted average, time decay, per-category breakdown) off-chain, where it can evolve without touching the contract. Every response is tagged with a scoring algorithm version so results are reproducible.
- **Issuer API** — authenticated endpoints for registered platforms to submit attestations. Can either submit the transaction on the platform's behalf (custodial signer, sponsored fees) or return unsigned XDR for the platform to sign itself — the latter is the more trust-minimized default.
- **Verification API** — public endpoint returning a worker's attestations, score, and a proof that the response matches on-chain state, so a consuming platform never has to blindly trust our database.
- **Fee sponsorship** — uses Stellar fee-bump transactions so workers never need to hold XLM for attestations to be written about them.

---

## Frontend (reference UI)

The frontend is a reference implementation, not the primary product surface:

- **Worker dashboard** — connect a wallet (Freighter/Albedo), view attestation history and score breakdown by category, generate a shareable public profile link/QR.
- **Issuer console** — for platforms to check registry status, submit attestations manually, and review disputes, without writing any integration code.
- **Embeddable widget** — a drop-in component other platforms can embed to display a worker's verified reputation pulled live from the API.

---

## Getting started

### Prerequisites
- Rust + `soroban-cli`
- Node.js 20+, pnpm
- Docker (for local Postgres/Redis)
- A funded Stellar testnet account ([Friendbot](https://friendbot.stellar.org))

### Local setup

```bash
git clone https://github.com/<org>/reputation-passport.git
cd reputation-passport

# 1. Build and deploy contracts to testnet
cd contracts
make build
make deploy-testnet

# 2. Start backend services
cd ../backend
docker compose up -d        # Postgres, Redis
pnpm install
pnpm run migrate
pnpm run start:dev

# 3. Run the SDK examples
cd ../sdk/ts
pnpm install
pnpm run example:attest

# 4. Run the frontend
cd ../../frontend/worker-dashboard
pnpm install
pnpm run start
```

Full setup and environment variable reference: [`docs/architecture.md`](docs/architecture.md).

---

## Trust & security model

- **Issuer accountability** — platforms must register and stake to write attestations; bad actors can be suspended or slashed by contract governance.
- **No central rewrite authority** — attestations are append-only; corrections happen via new attestations + revocation flags, preserving history.
- **Verifiable, not just trusted, scores** — the scoring algorithm is versioned and published so any consumer can recompute a score from raw on-chain attestations independently of our backend.
- **Privacy by design** — no PII on-chain; only hashes, with actual data in encrypted off-chain storage under the worker's control.
- **Sybil resistance** — enforced at two levels: issuer registration (stake/bond) and, optionally, worker-level identity binding (see [Open design decisions](#open-design-decisions)).

This project does not currently have a formal third-party security audit. **Do not use in production with real funds or real worker data until contracts have been audited.**

---

## Open design decisions

These are deliberately not settled yet — flagged here so contributors know what's still architecturally open:

- **Dispute resolution** — self-correction by issuers, an arbitration multisig, or a DAO-style vote for contested attestations?
- **Worker-level Sybil resistance** — nothing currently stops a worker from abandoning a bad-history wallet for a fresh one. Options: proof-of-personhood, KYC'd onboarding by the first issuing platform, or accepting this as an acceptable cost for privacy.
- **Cross-platform rating semantics** — a "5-star rating" on one platform isn't the same signal as a "completion rate" on another. A shared taxonomy (see [`docs/taxonomy.md`](docs/taxonomy.md)) is required or cross-platform scores are not meaningful.
- **Issuer trust weighting** — should a new, unverified platform's attestation carry the same weight as an established one's?

---

## Roadmap

- [ ] `attestation-registry` + `issuer-registry` contracts with full test coverage (testnet)
- [ ] TypeScript SDK v0 (attest / getProfile / verify)
- [ ] Indexer + scoring engine v0 (single scoring algorithm, versioned)
- [ ] Verification API with on-chain proof checking
- [ ] Worker dashboard (Angular)
- [ ] Embeddable reputation widget
- [ ] Dispute resolution mechanism (design + implementation)
- [ ] Mainnet audit and deployment

---

## Contributing

Issues and PRs are welcome. Please open an issue to discuss significant architectural changes (especially to the contract storage layout or scoring algorithm) before submitting a PR. See [`docs/architecture.md`](docs/architecture.md) for the fuller design rationale before diving in.

---

## License

MIT — see [`LICENSE`](LICENSE).
