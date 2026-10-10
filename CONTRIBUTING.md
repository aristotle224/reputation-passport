# Contributing

Thank you for your interest in reputation-passport. Read this guide before
opening a PR or issue.

---

## Before you start

1. Read [README.md](README.md) in full — it is the binding specification.
2. Read [docs/architecture.md](docs/architecture.md) for the system design.
3. Check [STATUS.md](STATUS.md) to understand what's complete, what's stubbed,
   and what's still an open design decision.

For significant changes — especially to contract storage layout, scoring
algorithm, or SDK public API — open an issue first to discuss the approach.
Architectural PRs without a prior issue discussion are likely to be sent back
for redesign.

---

## Development setup

See [README.md → Getting started](README.md#getting-started) for the full setup.
Short version:

```bash
# Contracts (Rust / Soroban)
cd contracts && cargo test

# SDK
cd sdk/ts && pnpm install && pnpm test
cd sdk/widget && pnpm install && pnpm test

# Backend
cd backend && pnpm install
docker compose up -d
pnpm run migrate
pnpm test

# Frontend
cd frontend/worker-dashboard && pnpm install && ng build
cd frontend/issuer-console    && pnpm install && ng build
```

---

## Project structure

```
contracts/          Rust/Soroban smart contracts
sdk/ts/             @reputation-passport/sdk (server-side issuer client)
sdk/widget/         @reputation-passport/widget (browser-safe read-only client)
backend/            NestJS backend (indexer, scoring, APIs, sponsorship)
frontend/
  worker-dashboard/ Angular worker-facing app
  issuer-console/   Angular issuer-facing app
  embeddable-widget/ Self-contained <reputation-badge> web component
docs/               Architecture, data model, scoring spec, taxonomy
```

---

## Contribution areas

### Contracts (`contracts/`)
- Rust, Soroban SDK.
- All changes to public function signatures or storage layout require a
  migration path and a version bump in `docs/data-model.md`.
- Never add on-chain scoring logic — README explicitly keeps scoring off-chain.
- Run `cargo test` across the workspace before submitting.

### SDK (`sdk/`)
- TypeScript, `@stellar/stellar-sdk`.
- `sdk/ts` is the server-side issuer SDK; `sdk/widget` is the browser-safe
  read-only client. Do not add signing/wallet code to `sdk/widget`.
- Maintain the public API shape shown in README.md's SDK example.
- Add or update unit tests for any new functionality.

### Backend (`backend/`)
- NestJS, TypeScript, PostgreSQL.
- New endpoints go in the appropriate module (`issuer-api`, `verification-api`,
  `sponsorship`). Don't add new modules without discussion.
- Scoring algorithm changes require a version bump in `ScoringService` and an
  update to `docs/scoring-spec.md`.
- The trust-minimized path (unsigned XDR default) must remain the default.

### Frontend (`frontend/`)
- Angular 21 (worker-dashboard, issuer-console), vanilla TS (embeddable-widget).
- `worker-dashboard` uses `sdk/widget` for read calls — do not import `sdk/ts`
  in the browser bundle.
- Keep styling functional over polished; no new CSS frameworks without discussion.

### Docs (`docs/`)
- Keep all docs in sync with the actual implementation, not aspirational state.
- If you change a contract interface, scoring formula, or API route, update the
  relevant doc in the same PR.

---

## Open design decisions

The following are intentionally unresolved — do not implement them without
a prior design discussion:

- **Dispute resolution** — options: issuer self-correction, arbitration multisig,
  or DAO-style vote. See README.md.
- **Worker-level Sybil resistance** — nothing currently prevents abandoning a
  bad-history wallet. Options: proof-of-personhood, KYC'd onboarding.
- **Cross-platform rating semantics** — see `docs/taxonomy.md`.
- **Issuer trust weighting** — all issuers currently carry equal scoring weight.

If you have a concrete proposal for any of these, open an issue with a design
doc rather than a code PR.

---

## Code style

- TypeScript: follow the existing `tsconfig.json` strictness settings. No `any`.
- Rust: `cargo fmt` and `cargo clippy` before committing.
- Commits: imperative mood, ≤72 chars subject. No merge commits in PRs (rebase).

---

## Pull request checklist

- [ ] `cargo test` passes (if contracts changed).
- [ ] `pnpm test` passes in all affected packages.
- [ ] `ng build` passes in affected Angular apps.
- [ ] Docs updated if a public interface changed.
- [ ] No new architectural components not described in README.md.
- [ ] No on-chain scoring logic added.
- [ ] Trust-minimized path remains the default in issuer-api.

---

## License

By contributing you agree that your contributions will be licensed under the
[MIT License](LICENSE).
