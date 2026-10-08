export interface ReputationScoreResult {
  /** Overall weighted score, 0–5 scale, 2 decimal places. */
  score: number;
  /** Per-category score breakdown (only categories with ≥1 attestation). */
  breakdown: Record<string, number>;
  /** Count of non-revoked attestations used in the calculation. */
  attestationCount: number;
  /**
   * Scoring algorithm version. Consumers can recompute the score
   * independently using docs/scoring-spec.md.
   */
  algorithmVersion: string;
}
