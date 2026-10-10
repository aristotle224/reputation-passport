/**
 * ReputationService — wraps the verification API via WidgetClient from
 * @reputation-passport/widget.
 *
 * Because the widget package has no Node.js dependencies it can be imported
 * directly in the Angular browser bundle, per README.md's distinction:
 * > sdk/widget — read-only, browser-safe client … No wallet or signing required.
 *
 * The backendUrl is read from the Angular environment (see environment.ts).
 */

import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import type { WorkerProfile } from '../models/types';

/**
 * Inline minimal API client — mirrors WidgetClient from sdk/widget without
 * the npm package import so the Angular app builds without a workspace link.
 * When the widget package is published and linked, replace this with:
 *   import { WidgetClient } from '@reputation-passport/widget';
 */
class InlineWidgetClient {
  private readonly base: string;
  constructor(backendUrl: string) {
    this.base = backendUrl.replace(/\/$/, '');
  }
  async getProfile(address: string): Promise<WorkerProfile> {
    const r = await fetch(`${this.base}/api/v1/verification/profile/${encodeURIComponent(address)}`);
    if (!r.ok) throw new Error(`API ${r.status}`);
    return r.json() as Promise<WorkerProfile>;
  }
}

@Injectable({ providedIn: 'root' })
export class ReputationService {
  private readonly client = new InlineWidgetClient(environment.backendUrl);

  /**
   * Load the full profile for a worker address.
   * Returns null if the worker has no attestations yet.
   */
  async loadProfile(workerAddress: string): Promise<WorkerProfile | null> {
    try {
      return await this.client.getProfile(workerAddress);
    } catch {
      return null;
    }
  }
}
