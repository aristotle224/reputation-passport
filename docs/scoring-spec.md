# Scoring Algorithm Specification

## Version: v1

Every response from the scoring engine is tagged with `algorithmVersion: "v1"`.
Any consumer can recompute a score independently from raw on-chain attestations
using this spec, without trusting the backend.

---

## Overview

The scoring engine runs entirely off-chain (per README.md — no scoring logic
on the contracts). It reads non-revoked attestations from the Postgres database
(populated by the indexer) and computes a composite reputation score with:

- **Time decay** — recent attestations carry more weight than old ones.
- **Per-category breakdown** — separate scores for each job type.
- **Weighted averaging** — job weight (e.g. job value/duration) affects the score.

---

## Formula

### 1. Time decay

Each attestation's *effective weight* is discounted by an exponential decay
factor based on how old the attestation is:

```
age_days(a)        = (now_unix_seconds - a.timestamp) / 86400
effective_weight(a) = a.weight × e^(−λ × age_days(a))
```

**Parameters:**
- `λ = 0.001` per day
- Half-life ≈ ln(2) / 0.001 ≈ **693 days** (roughly 2 years)

This means an attestation from 2 years ago carries ~50% of the weight of an
equally-weighted attestation written today.

### 2. Normalized rating

On-chain ratings are stored on a 0–500 scale. They are normalized to 0–5 for
output:

```
normalized_rating(a) = a.rating / 100
```

### 3. Per-category weighted average

For each job type category `c`:

```
score_category(c) = Σ_{a in c}(effective_weight(a) × normalized_rating(a))
                  / Σ_{a in c}(effective_weight(a))
```

Returns 0 if there are no attestations in that category.

### 4. Overall score

```
score_overall = Σ_all(effective_weight(a) × normalized_rating(a))
              / Σ_all(effective_weight(a))
```

Returns 0 if there are no non-revoked attestations.

---

## Response shape

```json
{
  "score": 4.6,
  "breakdown": {
    "delivery": 4.8,
    "rideshare": 4.2
  },
  "attestationCount": 132,
  "algorithmVersion": "v1"
}
```

- `score` — overall weighted average, rounded to 2 decimal places.
- `breakdown` — per-category scores, only categories with ≥1 attestation present.
- `attestationCount` — count of *non-revoked* attestations used in the calculation.
- `algorithmVersion` — always `"v1"` for this spec.

---

## Open design decisions

The following scoring concerns are intentionally unresolved per README.md's
"Open design decisions" section:

- **Issuer trust weighting** — all issuers currently carry equal weight.
  A future version may weight established issuers more heavily.
- **Rating semantic normalization** — a "5-star rating" on one platform is
  not the same signal as a "completion rate" on another. Cross-platform
  scoring is only meaningful once `docs/taxonomy.md` defines a shared
  semantic for each job type and rating dimension.
- **Category weighting** — the overall score currently weights all categories
  equally by their effective attestation weights. A future version may allow
  platform-defined category priorities.
