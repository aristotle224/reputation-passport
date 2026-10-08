/**
 * @reputation-passport/sdk — main entry point.
 *
 * Primary integration surface for partner platforms.
 *
 * Quick start:
 * ```ts
 * import { ReputationClient } from '@reputation-passport/sdk';
 *
 * const client = new ReputationClient({ network: 'testnet', issuerKey: myIssuerKey });
 * await client.attest({ subject, jobType: 'delivery', rating: 480, weight: 1, evidenceHash: hash });
 * const profile = await client.getProfile(workerAddress);
 * ```
 */

export { ReputationClient } from './client';
export { SponsorshipClient } from './sponsorship';
export { parseAttestationWrittenEvent, parseIssuerRegisteredEvent } from './events';
export { NETWORK_CONFIGS, DEFAULT_CONTRACT_IDS } from './config';

export type {
  ReputationClientConfig,
  AttestInput,
  Attestation,
  WorkerProfile,
  ReputationScore,
  JobType,
  IssuerStatus,
} from './types';
export type { AttestationWrittenEvent, IssuerRegisteredEvent } from './events';
export type { SponsorshipConfig } from './sponsorship';
