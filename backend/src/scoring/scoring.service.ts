import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.module';
import { ReputationScoreResult } from './dto/score-result.dto';

/**
 * Scoring engine — computes weighted, time-decayed, per-category reputation
 * scores from indexed attestations.
 *
 * Algorithm version: v1 (see docs/scoring-spec.md for the full specification).
 * Every response is tagged with algorithmVersion so consumers can reproduce
 * the score independently from raw on-chain attestations.
 */
@Injectable()
export class ScoringService {
  /** Algorithm version tag — increment when the formula changes. */
  readonly ALGORITHM_VERSION = 'v1';

  /**
   * Exponential decay constant λ (per day).
   * Half-life = ln(2) / λ ≈ 693 days ≈ 2 years.
   */
  readonly DECAY_LAMBDA = 0.001;

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  /**
   * Compute a composite reputation score for the given worker address.
   *
   * Reads non-revoked attestations from Postgres (populated by the indexer)
   * and applies the v1 scoring formula:
   *   effective_weight = weight × e^(−λ × age_days)
   *   score = Σ(effective_weight × normalized_rating) / Σ(effective_weight)
   *   normalized_rating = rating / 100  (on-chain 0–500 → output 0–5)
   */
  async computeScore(workerAddress: string): Promise<ReputationScoreResult> {
    const { rows } = await this.pool.query<{
      job_type: string;
      rating: number;
      weight: number;
      timestamp: string;
    }>(
      `SELECT job_type, rating, weight, timestamp
         FROM attestations
        WHERE subject_address = $1
          AND revoked = false`,
      [workerAddress],
    );

    if (rows.length === 0) {
      return {
        score: 0,
        breakdown: {},
        attestationCount: 0,
        algorithmVersion: this.ALGORITHM_VERSION,
      };
    }

    const nowSeconds = Date.now() / 1000;

    // Accumulate weighted sums per category and overall.
    const categoryWeightedSum: Record<string, number> = {};
    const categoryEffectiveWeightSum: Record<string, number> = {};
    let overallWeightedSum = 0;
    let overallEffectiveWeightSum = 0;

    for (const row of rows) {
      const ageSeconds = nowSeconds - Number(row.timestamp);
      const ageDays = ageSeconds / 86400;
      const effectiveWeight = row.weight * Math.exp(-this.DECAY_LAMBDA * ageDays);
      const normalizedRating = row.rating / 100;

      const category = row.job_type;
      categoryWeightedSum[category] =
        (categoryWeightedSum[category] ?? 0) + effectiveWeight * normalizedRating;
      categoryEffectiveWeightSum[category] =
        (categoryEffectiveWeightSum[category] ?? 0) + effectiveWeight;

      overallWeightedSum += effectiveWeight * normalizedRating;
      overallEffectiveWeightSum += effectiveWeight;
    }

    // Per-category scores.
    const breakdown: Record<string, number> = {};
    for (const category of Object.keys(categoryWeightedSum)) {
      const categoryScore =
        categoryEffectiveWeightSum[category] > 0
          ? categoryWeightedSum[category] / categoryEffectiveWeightSum[category]
          : 0;
      breakdown[category] = round2(categoryScore);
    }

    const overallScore =
      overallEffectiveWeightSum > 0
        ? overallWeightedSum / overallEffectiveWeightSum
        : 0;

    return {
      score: round2(overallScore),
      breakdown,
      attestationCount: rows.length,
      algorithmVersion: this.ALGORITHM_VERSION,
    };
  }
}

/** Round to 2 decimal places. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
