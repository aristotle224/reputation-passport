/**
 * WidgetClient — browser-safe, read-only reputation client.
 *
 * This package exists precisely to serve contexts where sdk/ts cannot be used:
 * - Embeddable widgets dropped into third-party HTML pages.
 * - Frontend applications that must not include signing keys or Node.js deps.
 *
 * It wraps the backend verification API (built in Day 5) with no wallet or
 * signing requirement.  No stellar-sdk dependency — fetch only.
 *
 * Per README.md "SDK" section:
 * > sdk/widget — read-only, browser-safe client for embeddable reputation
 * > badges. No wallet or signing required.
 */

import type { AttestationRecord, ReputationScore, WidgetClientConfig, WorkerProfile } from './types';

export class WidgetClient {
  private readonly backendUrl: string;

  constructor(config: WidgetClientConfig) {
    // Strip trailing slash for consistent URL construction.
    this.backendUrl = config.backendUrl.replace(/\/$/, '');
  }

  /**
   * Fetch a worker's full profile (score + attestations + proof) from the
   * verification API.
   *
   * @param workerAddress - The worker's Stellar G-address.
   */
  async getProfile(workerAddress: string): Promise<WorkerProfile> {
    const url = `${this.backendUrl}/api/v1/verification/profile/${encodeURIComponent(workerAddress)}`;
    const response = await this._fetch(url);
    return response as WorkerProfile;
  }

  /**
   * Fetch only the composite reputation score for a worker.
   *
   * This is a thin wrapper around getProfile() that discards the attestation
   * list, so callers that only need the score badge value don't have to
   * process the full payload.
   */
  async getScore(workerAddress: string): Promise<ReputationScore> {
    const profile = await this.getProfile(workerAddress);
    return {
      score: profile.score,
      breakdown: profile.breakdown,
      attestationCount: profile.attestationCount,
      algorithmVersion: profile.algorithmVersion,
    };
  }

  /**
   * Fetch all indexed attestations for a worker.
   *
   * Returns attestations in reverse-chronological order (most recent first),
   * including revoked ones.  Callers can filter on `revoked` themselves.
   */
  async getAttestations(workerAddress: string): Promise<AttestationRecord[]> {
    const url = `${this.backendUrl}/api/v1/verification/attestations/${encodeURIComponent(workerAddress)}`;
    const response = (await this._fetch(url)) as { attestations: AttestationRecord[] };
    return response.attestations ?? [];
  }

  /**
   * Verify a specific attestation by (subject, issuer, nonce).
   *
   * Returns the indexed attestation record and an on-chain verification note
   * so callers can independently confirm the record exists on Soroban.
   */
  async verifyAttestation(
    workerAddress: string,
    issuerAddress: string,
    nonce: number,
  ): Promise<{ found: boolean; attestation: AttestationRecord | null; onChainVerificationNote: string }> {
    const url = `${this.backendUrl}/api/v1/verification/verify/${encodeURIComponent(workerAddress)}/${encodeURIComponent(issuerAddress)}/${nonce}`;
    const response = await this._fetch(url);
    return response as { found: boolean; attestation: AttestationRecord | null; onChainVerificationNote: string };
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private async _fetch(url: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      throw new Error(`WidgetClient: network error fetching ${url}: ${(err as Error).message}`);
    }

    if (!response.ok) {
      throw new Error(
        `WidgetClient: API returned ${response.status} for ${url}`,
      );
    }

    return response.json() as Promise<unknown>;
  }
}
