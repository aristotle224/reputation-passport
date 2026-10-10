import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WalletService } from '../../services/wallet';

@Component({
  selector: 'app-connect-wallet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './connect-wallet.html',
  styleUrl: './connect-wallet.css',
})
export class ConnectWalletComponent {
  /** Emitted when a wallet connects successfully with the worker's address. */
  readonly connected = output<string>();

  connecting = false;
  error: string | null = null;

  constructor(private readonly walletService: WalletService) {}

  async connectFreighter(): Promise<void> {
    this.connecting = true;
    this.error = null;
    await this.walletService.connectFreighter();
    this._handleState();
  }

  async connectAlbedo(): Promise<void> {
    this.connecting = true;
    this.error = null;
    await this.walletService.connectAlbedo();
    this._handleState();
  }

  private _handleState(): void {
    this.connecting = false;
    const state = this.walletService.state();
    if (state.connected && state.address) {
      this.connected.emit(state.address);
    } else {
      this.error = state.error ?? 'Unknown error connecting wallet.';
    }
  }
}
