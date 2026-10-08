/**
 * Shared TypeScript types mirroring the on-chain structs defined in
 * contracts/shared/ and each contract's lib.rs.
 *
 * These types are the public surface of the SDK — keep them stable across
 * minor versions.
 */

/** Lifecycle status of a registered issuer platform. */
export type IssuerStatus = 'Active' | 'Suspended' | 'Delisted';

/**
 * Normalized job-type taxonomy, matching the shared::JobType enum in the
 * contracts.  See docs/taxonomy.md for the full vocabulary.
 */
export type JobType = 'delivery' | 'rideshare' | 'freelance-dev' | 'other';

/**
 * An on-chain attestation record, mirroring the Attestation struct in
 * attestation-registry/src/lib.rs.
 */
export interface Attestation {
  issuer: string;
  subject: string;
  jobType: JobType;
  /** Normalized rating on the 0–500 scale (500 = 5 stars). */
  rating: number;
  /** Job weight (e.g. job value/duration) used in weighted scoring. */
  weight: number;
  /** Ledger timestamp at write time (Unix seconds). */
  timestamp: number;
  /** Hex-encoded 32-byte IPFS/Arweave evidence pointer. */
  evidenceHash: string;
  revoked: boolean;
  /** Nonce assigned by the attestation-registry (key component for lookup). */
  nonce: bigint;
}

/**
 * On-chain worker profile record, mirroring the Worker struct in
 * profile-registry/src/lib.rs.
 */
export interface WorkerProfile {
  id: string;
  /** Ledger timestamp at registration time (Unix seconds). */
  createdAt: number;
  /** Hex-encoded 32-byte hash of encrypted off-chain profile data. */
  metadataHash: string;
}

/**
 * Composite reputation score returned by getProfile().
 * Always tagged with algorithmVersion so consumers can reproduce the score.
 */
export interface ReputationScore {
  /** Overall score on the 0–5 scale. */
  score: number;
  /** Per-category score breakdown (0–5 per category). */
  breakdown: Partial<Record<JobType, number>>;
  /** Total attestation count (including revoked). */
  attestationCount: number;
  /**
   * Scoring algorithm version.  Consumers can recompute the score from raw
   * attestations using the spec in docs/scoring-spec.md.
   */
  algorithmVersion: string;
}

/** Input to ReputationClient.attest(). */
export interface AttestInput {
  /** Worker's Stellar address. */
  subject: string;
  jobType: JobType;
  /** Rating on the 0–500 scale. */
  rating: number;
  /** Job weight (positive integer). */
  weight: number;
  /** Hex-encoded 32-byte evidence hash. */
  evidenceHash: string;
}

/** Configuration for ReputationClient. */
export interface ReputationClientConfig {
  network: 'testnet' | 'mainnet';
  /**
   * Stellar secret key (Sxxx…) for signing attest() calls.
   * Required for write operations; optional for read-only use.
   */
  issuerKey?: string;
  /**
   * Optional base URL for the backend verification API.
   * If set, getProfile() routes through the API rather than reading
   * directly from chain.  The direct-chain fallback is preserved so
   * the SDK never *requires* trusting our backend.
   */
  backendUrl?: string;
  /**
   * Override deployed contract IDs.  Defaults to env vars or testnet values
   * from config.ts.
   */
  contractIds?: {
    issuerRegistry?: string;
    attestationRegistry?: string;
    profileRegistry?: string;
  };
}
