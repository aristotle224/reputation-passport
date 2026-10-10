/**
 * WalletService — manages wallet connection state for Freighter and Albedo.
 *
 * Freighter is a browser extension wallet for Stellar.
 * Albedo is a web-based Stellar transaction signer.
 *
 * Both expose the worker's Stellar G-address to the dashboard without
 * requiring the app to hold a private key.
 *
 * Real Freighter/Albedo API calls require the respective browser extensions or
 * libraries.  The interface here stubs those calls so the dashboard compiles
 * and runs in demo mode without a live wallet.  See the TODO comments for
 * where to wire real calls when running against testnet.
 */

import { Injectable, signal } from '@angular/core';

export type WalletType = 'freighter' | 'albedo' | null;

export interface WalletState {
  connected: boolean;
  walletType: WalletType;
  address: string | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class WalletService {
  /** Reactive wallet state — components subscribe via Angular signals. */
  readonly state = signal<WalletState>({
    connected: false,
    walletType: null,
    address: null,
    error: null,
  });

  /**
   * Connect using Freighter.
   *
   * TODO: Replace stub with real Freighter API calls:
   * ```ts
   * import { isConnected, requestAccess, getPublicKey } from '@stellar/freighter-api';
   * await requestAccess();
   * const address = await getPublicKey();
   * ```
   * Requires the @stellar/freighter-api package (not included to avoid a
   * browser-extension hard dependency in the scaffold).
   */
  async connectFreighter(): Promise<void> {
    this.state.set({ connected: false, walletType: 'freighter', address: null, error: null });
    try {
      // Stub: simulate a successful connection.
      // In a live environment, call the Freighter extension APIs here.
      const address = this._stubAddress();
      this.state.set({ connected: true, walletType: 'freighter', address, error: null });
    } catch (err) {
      this.state.set({
        connected: false,
        walletType: null,
        address: null,
        error: `Freighter connection failed: ${(err as Error).message}`,
      });
    }
  }

  /**
   * Connect using Albedo.
   *
   * TODO: Replace stub with real Albedo API calls:
   * ```ts
   * import albedo from '@albedo-link/intent';
   * const { pubkey } = await albedo.publicKey({ require_existing: false });
   * ```
   */
  async connectAlbedo(): Promise<void> {
    this.state.set({ connected: false, walletType: 'albedo', address: null, error: null });
    try {
      const address = this._stubAddress();
      this.state.set({ connected: true, walletType: 'albedo', address, error: null });
    } catch (err) {
      this.state.set({
        connected: false,
        walletType: null,
        address: null,
        error: `Albedo connection failed: ${(err as Error).message}`,
      });
    }
  }

  disconnect(): void {
    this.state.set({ connected: false, walletType: null, address: null, error: null });
  }

  /** Stub: returns a deterministic placeholder address for demo use. */
  private _stubAddress(): string {
    return 'GABC1234STUB5678DEMO9012REPUTATIONPASSPORT0000000000000000000';
  }
}
