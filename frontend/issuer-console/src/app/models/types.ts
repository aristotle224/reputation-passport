/**
 * Shared types for the issuer console.
 */

export type JobType = 'delivery' | 'rideshare' | 'freelance-dev' | 'other';
export type IssuerStatus = 'Active' | 'Suspended' | 'Delisted' | 'Unknown';

export interface AttestRequest {
  issuerAddress: string;
  subject: string;
  jobType: JobType;
  /** 0–500 normalized scale. */
  rating: number;
  weight: number;
  /** Hex-encoded 32-byte evidence hash. */
  evidenceHash: string;
  /** If false (default), returns unsigned XDR for issuer to self-sign. */
  custodialSign?: boolean;
}

export interface AttestResponse {
  /** Unsigned transaction XDR (trust-minimized default path). */
  unsignedXdr?: string;
  /** Transaction hash (custodial path only). */
  txHash?: string;
}
