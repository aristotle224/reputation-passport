# STATUS.md — Sprint Completion Map

Last updated: 2026-10-10

This document maps every component named in README.md to its actual build state.
It is the evidence for the sprint's ~85% completion estimate. Be honest, not optimistic.

---

## Component status

| Component | State | Notes |
|---|---|---|
| `issuer-registry` contract | ✅ Done | Full CRUD, stake/bond, status transitions, unit tests, Makefile deploy target |
| `attestation-registry` contract | ✅ Done | Append-only writes, revocation, cross-contract issuer check, `AttestationWritten` event |
| `profile-registry` contract | ✅ Done | Worker identity mapping, key rotation, metadata hash storage |
| Contract integration tests | ✅ Done | Full lifecycle: unregistered write fails → register → write succeeds → revoke → new attestation |
| `contracts/shared` crate | ✅ Done | Common types (`JobType`, `IssuerStatus`, error codes) shared by all three contracts |
| `sdk/ts` — `ReputationClient.attest()` | ✅ Done | Builds, signs, submits to attestation-registry |
| `sdk/ts` — `ReputationClient.getProfile()` | ✅ Done | Calls verification API with direct-chain fallback |
| `sdk/ts` — `ReputationClient.revokeAttestation()` | ✅ Done | Revocation via SDK |
| `sdk/ts` — event parsers | ✅ Done | `parseAttestationWrittenEvent`, `parseIssuerRegisteredEvent` |
| `sdk/ts` — fee-bump stub | ✅ Done | `SponsorshipClient` interface stub; full service wired in backend |
| `sdk/widget` | ✅ Done | Browser-safe, read-only; wraps verification API; 7/7 tests pass |
| Backend NestJS scaffold | ✅ Done | All modules present; Docker Compose; Postgres migrations |
| Indexer | ✅ Done | Polls Soroban RPC `getEvents`, persists `AttestationWritten`/`IssuerRegistered` to Postgres |
| Scoring engine (v1) | ✅ Done | Weighted, time-decayed, per-category breakdown; versioned; documented in `docs/scoring-spec.md` |
| Issuer API | ✅ Done | Auth via `x-api-key`; unsigned XDR default (trust-minimized); custodial path available |
| Verification API | ✅ Done | Profile endpoint with proof keys; attestation list; per-attestation verify endpoint |
| Fee-bump sponsorship service | ✅ Done | `SponsorshipService.wrapFeeBump()` / `submitFeeBump()`; SPONSOR_SECRET required |
| Worker dashboard (Angular) | ✅ Done | Wallet connect (Freighter/Albedo stub), score card, attestation history, share/QR |
| Issuer console (Angular) | ✅ Done | Registry status lookup, manual attest form (unsigned XDR default), dispute placeholder |
| Embeddable widget (`<reputation-badge>`) | ✅ Done | Custom element, no framework, esbuild bundle; demo.html proves standalone use |
| `docs/architecture.md` | ✅ Done | Full system description, API routes, data flow |
| `docs/data-model.md` | ✅ Done | On-chain structs, events, Postgres schema, job type table |
| `docs/scoring-spec.md` | ✅ Done | v1 formula, decay constant, response shape, open decisions |
| `docs/taxonomy.md` | ✅ Done | Job type vocabulary, rating dimension mapping, semantic normalization open decision |
| `CONTRIBUTING.md` | ✅ Done | Setup, contribution areas, open design decisions, PR checklist |
| Dispute resolution | 🔓 Open design decision | UI placeholder in issuer-console; no logic — intentionally unresolved per README |

---

## What's partial or stubbed

| Item | Detail |
|---|---|
| Wallet connect (Freighter/Albedo) | `WalletService` stubs the wallet calls. Wire real `@stellar/freighter-api` / `@albedo-link/intent` calls to get live wallet addresses. TODOs are inline in `wallet.ts`. |
| Issuer status endpoint (`GET /api/v1/issuer/status/:address`) | `IssuerApiService` in the console calls this route, which doesn't exist in the backend yet. The console degrades to "Unknown" gracefully. Add a dedicated issuer-status controller to `issuer-api` module. |
| Embeddable widget npm publish | `esbuild` build step produces `dist/widget.js`; install deps with `npm install` in `frontend/embeddable-widget/` before building. |
| Worker-level Sybil resistance | Unresolved open design decision — see README and CONTRIBUTING. |
| Cross-platform rating semantics | `docs/taxonomy.md` defines the vocabulary; semantic normalization is an open decision. |
| Issuer trust weighting | All issuers carry equal scoring weight in v1. Future scoring versions may weight by issuer seniority/stake. |
| Dispute resolution | Three options documented in README. DisputePlaceholderComponent exists in issuer-console. No resolution logic. |
| Mainnet deployment | Not attempted. Contracts require a third-party security audit before mainnet. |

---

## What a contributor should tackle first

1. **Wire real wallet libraries** in `frontend/worker-dashboard/src/app/services/wallet.ts` (Freighter/Albedo TODOs).
2. **Add `GET /api/v1/issuer/status/:address`** to the backend `issuer-api` module so the console status tab shows live data.
3. **Design and decide** on the dispute resolution mechanism (issue + design doc before code).
4. **Finalize `docs/taxonomy.md`** — resolve the rating semantic normalization problem before cross-platform scores are meaningful.
5. **Audit contracts** before any mainnet deployment.
