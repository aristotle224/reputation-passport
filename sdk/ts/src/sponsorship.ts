/**
 * Fee-bump sponsorship helper.
 *
 * The full fee-bump implementation lives in backend/src/sponsorship — this
 * SDK-side client calls that service.  Workers never need to hold XLM; the
 * backend sponsors fees on their behalf using Stellar fee-bump transactions.
 *
 * Workflow:
 *   1. SDK builds the inner transaction (signed by the issuer).
 *   2. SDK sends the signed inner XDR to the sponsorship endpoint.
 *   3. Backend wraps it in a fee-bump transaction, signs the bump envelope.
 *   4. Returns the fee-bump XDR for final submission (or submits directly).
 */

export interface SponsorshipConfig {
  /** Base URL of the reputation-passport backend (e.g. http://localhost:3000). */
  sponsorUrl: string;
  /** Optional API key for authenticating with the sponsorship endpoint. */
  apiKey?: string;
}

export class SponsorshipClient {
  constructor(private readonly config: SponsorshipConfig) {}

  /**
   * Request a fee-bump wrapper from the backend sponsorship service.
   * The inner transaction must already be signed by the issuer.
   *
   * Returns the fee-bump transaction XDR (base64-encoded envelope).
   */
  async requestFeeBump(innerTxXdr: string): Promise<string> {
    const url = `${this.config.sponsorUrl}/api/v1/sponsorship/fee-bump`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) {
      headers['X-Api-Key'] = this.config.apiKey;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ innerTxXdr }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `SponsorshipClient.requestFeeBump failed (${response.status}): ${text}`,
      );
    }

    const data = (await response.json()) as { feeBumpXdr: string };
    return data.feeBumpXdr;
  }

  /**
   * Build a fee-bump wrapper and submit the transaction end-to-end.
   * Returns the submitted transaction hash.
   */
  async submitSponsored(innerTxXdr: string): Promise<string> {
    const url = `${this.config.sponsorUrl}/api/v1/sponsorship/fee-bump/submit`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) {
      headers['X-Api-Key'] = this.config.apiKey;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ innerTxXdr }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `SponsorshipClient.submitSponsored failed (${response.status}): ${text}`,
      );
    }

    const data = (await response.json()) as { txHash: string };
    return data.txHash;
  }
}
