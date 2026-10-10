# Architecture

## Overview

reputation-passport provides a neutral, platform-agnostic ledger of gig-worker
reputation backed by Stellar/Soroban smart contracts. This document describes
the actual system as built across the 7-day sprint.

```
                     ┌─────────────────────────┐
                     │   Soroban Contracts      │
                     │  (Stellar testnet)        │
                     │                          │
                     │  IssuerRegistry          │
                     │  AttestationRegistry     │
                     │  ProfileRegistry         │
                     └────────────┬─────────────┘
                                  │ events (AttestationWritten, IssuerRegistered)
                                  ▼
                     ┌─────────────────────────┐
                     │   NestJS Backend         │
                     │  (Node 20 + TypeScript)  │
                     │                          │
                     │  Indexer  → Postgres     │
                     │  Scoring Engine (v1)     │
                     │  Issuer API (auth)       │
                     │  Verification API        │
                     │  Fee-sponsorship service │
                     └────────────┬─────────────┘
                                  │ REST  (prefix /api/v1/)
                     ┌────────────┴─────────────┐
                     ▼                           ▼
        ┌───────────────────────┐   ┌───────────────────────────┐
        │  @reputation-passport │   │   Angular Apps             │
        │  /sdk  (server-side)  │   │  worker-dashboard          │
        │  /widget (browser)    │   │  issuer-console             │
        └───────────────────────┘   └───────────────────────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │  embeddable-widget   │
                                    │  (custom element,    │
                                    │   no framework)      │
                                    └─────────────────────┘
```

## Design principles

**Contract is the source of truth.** The NestJS backend and SDK are convenience
layers; all authoritative data lives in Soroban storage and is derivable from
on-chain events.

**SDK is the primary integration surface.** Most partner platforms will use
`@reputation-passport/sdk` on their server side and never touch the UI.

**Backend exists to make querying practical.** Scoring, time decay, and
cross-issuer aggregation would be too expensive and rigid to run on-chain.

**Trust-minimized by default.** The issuer-api returns unsigned XDR by default
so platforms sign locally. The verification API includes proof keys so
consumers can independently verify responses against Soroban state.

---

## Contracts layer (`contracts/`)

Three focused contracts share a `shared/` crate for common types and errors.

### `issuer-registry`
Allowlist of platforms permitted to write attestations.
- `register_issuer(address, stake)` — requires a minimum bond.
- `get_issuer_status(address)` → `Active | Suspended | Delisted`
- `suspend_issuer` / `delist_issuer` — admin-gated.
- Emits `IssuerRegistered` event on registration.

### `attestation-registry`
Append-only attestation store.
- `write_attestation(issuer, subject, job_type, rating, weight, evidence_hash)` —
  cross-contract checks issuer is `Active` in `issuer-registry`.
- `revoke_attestation(issuer, subject, nonce)` — sets `revoked = true` on the
  original; a correction is a new attestation write, preserving full history.
- Emits `AttestationWritten` on every successful write.
- Keys: `(subject, issuer, nonce)` — never mutated in place.

### `profile-registry`
Worker identity mapping.
- `register_worker(address, metadata_hash)` — creates a profile.
- `rotate_key(old_address, new_address)` — key rotation support.
- Stores `(id, created_at, metadata_hash)` per README's `Worker` struct.

### Cross-contract calls
`attestation-registry` calls `issuer-registry.get_issuer_status()` before
accepting any write. An unregistered or suspended issuer gets `Unauthorized`.

---

## Backend layer (`backend/`)

NestJS monolith (single deployable). Modules:

| Module | Path | Responsibility |
|---|---|---|
| `IndexerModule` | `src/indexer/` | Polls Soroban RPC `getEvents`, persists to Postgres |
| `ScoringModule` | `src/scoring/` | Versioned scoring algorithm (v1) |
| `IssuerApiModule` | `src/issuer-api/` | Authenticated write endpoints |
| `VerificationApiModule` | `src/verification-api/` | Public read + proof endpoints |
| `SponsorshipModule` | `src/sponsorship/` | Fee-bump transaction wrapping |
| `DatabaseModule` | `src/database/` | Postgres pool + migrations |

### API routes

All routes are prefixed `/api/v1/` (set in `main.ts`).

**Verification API (public):**
- `GET /verification/profile/:address` — score + attestations + proof
- `GET /verification/attestations/:address` — raw attestation list
- `GET /verification/verify/:address/:issuer/:nonce` — single attestation check

**Issuer API (authenticated via `x-api-key` header):**
- `POST /issuer/attest` — build attestation tx; returns unsigned XDR by default
- `POST /issuer/submit` — submit a pre-signed XDR

**Sponsorship:**
- `POST /sponsorship/wrap` — wrap signed inner tx in a fee-bump envelope
- `POST /sponsorship/submit` — wrap + submit

---

## SDK layer (`sdk/`)

### `sdk/ts` — `@reputation-passport/sdk`
Server-side / Node.js issuer SDK. Signing, XDR construction, fee-bump stub,
event parsers. See `sdk/ts/README.md`.

### `sdk/widget` — `@reputation-passport/widget`
Browser-safe, read-only client. No `stellar-sdk` dependency. Wraps the
verification API. Used by Angular apps and the embeddable widget.
See `sdk/widget/README.md`.

---

## Frontend layer (`frontend/`)

### `worker-dashboard`
Angular 21 app. Connect Freighter/Albedo wallet → view score + attestation
history → generate shareable profile link + QR code.

Wallet connection is stubbed pending real Freighter/Albedo library integration
(see `WalletService` TODOs).

### `issuer-console`
Angular 21 app. Registry status lookup, manual attestation submission (returns
unsigned XDR by default), dispute review placeholder.

### `embeddable-widget`
Self-contained web component (`<reputation-badge>`). Built with esbuild into a
single `dist/widget.js` bundle — no framework dependency. Drop into any HTML
page with a `<script>` tag. See `frontend/embeddable-widget/demo.html`.

---

## Data flow: attest → index → score → verify

```
Platform (SDK)
  │  attest({ subject, jobType, rating, ... })
  │
  ├─ Trust-minimized: returns unsigned XDR → platform signs → submits
  └─ Custodial: issuer-api signs with SPONSOR_SECRET → submits
                                 │
                  attestation-registry contract
                  emits AttestationWritten event
                                 │
                          Indexer (polls getEvents)
                          persists to Postgres
                                 │
                    ScoringService.computeScore()
                    weighted, time-decayed, versioned
                                 │
                    VerificationAPI GET /profile/:address
                    → score + proof keys
                                 │
                    SDK getProfile() / WidgetClient.getScore()
                    → { score, breakdown, attestationCount, algorithmVersion }
```

---

## Environment variables

See `backend/.env.example` for the full reference. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SOROBAN_RPC_URL` | Soroban RPC endpoint |
| `NETWORK_PASSPHRASE` | Stellar network passphrase |
| `ISSUER_REGISTRY_ID` | Deployed issuer-registry contract ID |
| `ATTESTATION_REGISTRY_ID` | Deployed attestation-registry contract ID |
| `PROFILE_REGISTRY_ID` | Deployed profile-registry contract ID |
| `SPONSOR_SECRET` | Funded Stellar secret key for fee-bump sponsorship |
| `ISSUER_API_KEYS` | Comma-separated `address:apikey` pairs |

---

## Open design decisions

These remain intentionally unresolved per README.md:

- **Dispute resolution** — self-correction, arbitration multisig, or DAO vote.
- **Worker-level Sybil resistance** — nothing prevents abandoning a bad-history wallet.
- **Cross-platform rating semantics** — requires `docs/taxonomy.md` to be finalized.
- **Issuer trust weighting** — all issuers currently carry equal scoring weight.

See README.md's "Open design decisions" section and `docs/scoring-spec.md` for details.
