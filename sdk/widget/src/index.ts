/**
 * @reputation-passport/widget — browser-safe, read-only reputation client.
 *
 * This package wraps the reputation-passport verification API without any
 * signing, wallet, or Node.js-only dependencies.  Drop it into any browser
 * environment (Angular, React, plain HTML) to display verified reputation.
 *
 * Quick start:
 * ```ts
 * import { WidgetClient } from '@reputation-passport/widget';
 *
 * const client = new WidgetClient({ backendUrl: 'https://api.example.com' });
 * const profile = await client.getProfile(workerAddress);
 * // { score: 4.6, breakdown: { delivery: 4.8 }, attestationCount: 132, ... }
 * ```
 *
 * For write operations (attest, revoke), use @reputation-passport/sdk instead.
 */

export { WidgetClient } from './client';
export type {
  WidgetClientConfig,
  WorkerProfile,
  ReputationScore,
  AttestationRecord,
  JobType,
} from './types';
