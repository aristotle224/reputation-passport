export class AttestDto {
  /** Worker's Stellar address (G…). */
  subject: string;
  /** Job type matching the shared taxonomy. */
  jobType: string;
  /** Rating on the 0–500 scale. */
  rating: number;
  /** Job weight (positive integer). */
  weight: number;
  /** Hex-encoded 32-byte evidence hash (IPFS/Arweave CID). */
  evidenceHash: string;
  /** The registered issuer's Stellar address. */
  issuerAddress: string;
  /**
   * If true, the backend signs and submits the transaction itself
   * (custodial path). Default is false — the trust-minimized default
   * per README.md returns unsigned XDR for the platform to sign.
   */
  custodialSign?: boolean;
}

export class SubmitSignedDto {
  /** Base64-encoded signed transaction XDR. */
  signedXdr: string;
}

export class AttestResponseDto {
  /** Unsigned transaction XDR (trust-minimized default). */
  unsignedXdr?: string;
  /** Transaction hash (only present when custodialSign=true). */
  txHash?: string;
}
