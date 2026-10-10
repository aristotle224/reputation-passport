/**
 * Shared types for the widget SDK.
 *
 * Kept intentionally minimal — no wallet, signing, or Node-only dependencies.
 * The full type set is in sdk/ts/src/types.ts; this file re-exports only what
 * is needed for read-only browser use.
 */

export type JobType = 'delivery' | 'rideshare' | 'freelance-dev' | 'other';

/**
 * A single indexed attestation, as returned by the verification API.
 */
export interface AttestationRecord {
  issuerAddress: string;
  subjectAddress: string;
  nonce: number;
  jobType: string;
  /** Rating on the 0–500 on-chain scale. */
  rating: number;
  weight: number;
  /** Unix timestamp (seconds). */
  timestamp: number;
  evidenceHash: string;
  revoked: boolean;
  ledgerSequence: number;
}

/**
 * Composite reputation score, always tagged with algorithmVersion so callers
 * can reproduce the score independently.  Mirrors ReputationScore in sdk/ts.
 */
export interface ReputationScore {
  score: number;
  breakdown: Partial<Record<string, number>>;
  attestationCount: number;
  algorithmVersion: string;
}

/**
 * Full profile as returned by GET /api/v1/verification/profile/:address.
 */
export interface WorkerProfile {
  workerAddress: string;
  attestations: AttestationRecord[];
  score: number;
  breakdown: Partial<Record<string, number>>;
  attestationCount: number;
  algorithmVersion: string;
  proof: {
    description: string;
    attestationKeys: { issuer: string; subject: string; nonce: number }[];
  };
}

/** Configuration for WidgetClient. */
export interface WidgetClientConfig {
  /**
   * Base URL of the backend verification API.
   * Example: 'https://api.reputation-passport.example.com'
   */
  backendUrl: string;
}
