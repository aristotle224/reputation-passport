# Job-Type and Rating Taxonomy

This document defines the shared vocabulary for job types and rating dimensions
across all issuers. It is referenced by `docs/data-model.md` and
`docs/scoring-spec.md`.

> **Status: initial draft.** Cross-platform rating semantics are an open design
> decision in this protocol (see README.md "Open design decisions"). This
> taxonomy defines the current vocabulary but does not yet resolve the semantic
> normalization problem described below.

---

## Job types

| On-chain variant | SDK string | Description |
|---|---|---|
| `Delivery` | `delivery` | Same-day package, parcel, or food delivery |
| `Rideshare` | `rideshare` | Passenger transport (private hire, ride-hailing) |
| `FreelanceDev` | `freelance-dev` | Software development / engineering work |
| `Other` | `other` | Any work that does not fit the above categories |

New variants require a contract upgrade to `attestation-registry` and a version
bump to `docs/scoring-spec.md`. Do not add variants without updating both.

---

## Rating dimensions

All ratings are stored on a **0–500 integer scale** on-chain and normalized to
**0.0–5.0** for display and scoring. The mapping is: `display = rating / 100`.

Each issuer maps its own internal rating scale to this range before writing an
attestation. The recommended mappings are:

| Platform scale | Mapping to 0–500 |
|---|---|
| 1–5 stars | `(stars / 5) × 500` — e.g. 4.8 stars → 480 |
| 1–10 score | `(score / 10) × 500` — e.g. 8.5 → 425 |
| Percentage (0–100%) | `percentage × 5` — e.g. 95% → 475 |
| Binary pass/fail | Pass → 400 (4.0 equivalent), Fail → 0 |

Issuers **must document their mapping** in their issuer registration metadata
so consumers can interpret the rating correctly.

---

## Open semantic problem

A "5-star rating" on a delivery platform is not the same signal as a "95%
completion rate" on a freelance platform. The current scoring engine
(`docs/scoring-spec.md` v1) treats all ratings on the same 0–500 scale without
any cross-platform semantic normalization.

This means cross-category or cross-issuer aggregated scores should be
interpreted with caution until this problem is resolved. Options under
consideration:

- **Attestation-level normalization fields** — add a `rating_dimension` field
  to the attestation struct so the scoring engine can normalize per dimension.
- **Issuer-registered rating schema** — issuers declare their rating semantics
  at registration time; the scoring engine uses those declarations.
- **Per-category separate scores only** — never aggregate across categories,
  only show per-category breakdowns.

This decision is flagged in README.md "Open design decisions" and must be
resolved before cross-platform scores are considered production-meaningful.
