/**
 * IssuerApiService — wraps the backend issuer-api endpoints.
 *
 * Calls POST /api/v1/issuer/attest (trust-minimized default: returns unsigned
 * XDR for the platform to sign; or custodial path via custodialSign=true).
 *
 * Also proxies GET /api/v1/verification endpoints for registry status checks.
 */

import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import type { AttestRequest, AttestResponse, IssuerStatus } from '../models/types';

@Injectable({ providedIn: 'root' })
export class IssuerApiService {
  private readonly base = environment.backendUrl.replace(/\/$/, '');

  /**
   * Submit an attestation.
   * Default: returns unsigned XDR the issuer signs locally.
   */
  async attest(req: AttestRequest, apiKey: string): Promise<AttestResponse> {
    const r = await fetch(`${this.base}/api/v1/issuer/attest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(req),
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Attest failed (${r.status}): ${text}`);
    }
    return r.json() as Promise<AttestResponse>;
  }

  /**
   * Check the registry status of an issuer address via the verification API.
   * Returns the raw profile object; the status field is embedded as a proxy
   * for issuer registry status until a dedicated endpoint is added.
   */
  async getIssuerStatus(issuerAddress: string): Promise<IssuerStatus> {
    // The verification API doesn't expose issuer status directly.
    // This calls a hypothetical /issuer/:address endpoint (add to backend when
    // building a dedicated issuer-status route — flagged as Needs Decision).
    // For now return 'Unknown' to keep the UI functional.
    try {
      const r = await fetch(
        `${this.base}/api/v1/issuer/status/${encodeURIComponent(issuerAddress)}`,
      );
      if (!r.ok) return 'Unknown';
      const data = (await r.json()) as { status: IssuerStatus };
      return data.status ?? 'Unknown';
    } catch {
      return 'Unknown';
    }
  }
}
