/**
 * Shared types for the worker dashboard.
 * Mirrors the shapes returned by the reputation-passport verification API.
 */

export type JobType = 'delivery' | 'rideshare' | 'freelance-dev' | 'other';

export interface AttestationRecord {
  issuerAddress: string;
  subjectAddress: string;
  nonce: number;
  jobType: string;
  rating: number;
  weight: number;
  timestamp: number;
  evidenceHash: string;
  revoked: boolean;
  ledgerSequence: number;
}

export interface WorkerProfile {
  workerAddress: string;
  attestations: AttestationRecord[];
  score: number;
  breakdown: Record<string, number>;
  attestationCount: number;
  algorithmVersion: string;
  proof: {
    description: string;
    attestationKeys: { issuer: string; subject: string; nonce: number }[];
  };
}
