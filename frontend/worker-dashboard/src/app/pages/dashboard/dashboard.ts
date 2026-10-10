import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../services/wallet';
import { ReputationService } from '../../services/reputation';
import { ConnectWalletComponent } from '../../components/connect-wallet/connect-wallet';
import { ScoreCardComponent } from '../../components/score-card/score-card';
import { AttestationListComponent } from '../../components/attestation-list/attestation-list';
import { ShareProfileComponent } from '../../components/share-profile/share-profile';
import type { WorkerProfile } from '../../models/types';

type DashboardView = 'score' | 'history' | 'share';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ConnectWalletComponent,
    ScoreCardComponent,
    AttestationListComponent,
    ShareProfileComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent {
  state: 'disconnected' | 'loading' | 'loaded' | 'error' = 'disconnected';
  activeView: DashboardView = 'score';
  profile: WorkerProfile | null = null;
  errorMessage = '';

  constructor(
    readonly walletService: WalletService,
    private readonly reputationService: ReputationService,
  ) {}

  async onWalletConnected(address: string): Promise<void> {
    this.state = 'loading';
    const result = await this.reputationService.loadProfile(address);
    if (result) {
      this.profile = result;
      this.state = 'loaded';
    } else {
      // New worker — no attestations yet; show an empty profile.
      this.profile = {
        workerAddress: address,
        attestations: [],
        score: 0,
        breakdown: {},
        attestationCount: 0,
        algorithmVersion: 'v1',
        proof: { description: '', attestationKeys: [] },
      };
      this.state = 'loaded';
    }
  }

  disconnect(): void {
    this.walletService.disconnect();
    this.state = 'disconnected';
    this.profile = null;
  }

  setView(v: DashboardView): void {
    this.activeView = v;
  }

  get address(): string | null {
    return this.walletService.state().address;
  }

  shortAddress(addr: string | null): string {
    if (!addr) return '';
    return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
  }
}
