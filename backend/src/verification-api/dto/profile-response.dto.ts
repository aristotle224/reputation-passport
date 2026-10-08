export class ProfileResponseDto {
  workerAddress: string;
  attestations: AttestationDto[];
  score: number;
  breakdown: Record<string, number>;
  attestationCount: number;
  algorithmVersion: string;
  /**
   * On-chain proof: the Soroban storage key pattern for attestations belonging
   * to this worker. Consumers can verify these exist on chain independently.
   * Full ledger entry proof requires a direct Soroban RPC getLedgerEntries call.
   */
  proof: {
    description: string;
    attestationKeys: { issuer: string; subject: string; nonce: number }[];
  };
}

export class AttestationDto {
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

export class VerifyResponseDto {
  issuer: string;
  subject: string;
  nonce: number;
  found: boolean;
  attestation: AttestationDto | null;
  onChainVerificationNote: string;
}
