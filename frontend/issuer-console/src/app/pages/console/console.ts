import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IssuerApiService } from '../../services/issuer-api';
import { RegistryStatusComponent } from '../../components/registry-status/registry-status';
import { AttestFormComponent } from '../../components/attest-form/attest-form';
import { DisputePlaceholderComponent } from '../../components/dispute-placeholder/dispute-placeholder';
import type { AttestResponse, IssuerStatus } from '../../models/types';

type ConsoleView = 'status' | 'attest' | 'disputes';

@Component({
  selector: 'app-console',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RegistryStatusComponent,
    AttestFormComponent,
    DisputePlaceholderComponent,
  ],
  templateUrl: './console.html',
  styleUrl: './console.css',
})
export class ConsoleComponent {
  activeView: ConsoleView = 'status';

  issuerAddress = '';
  inputAddress = '';

  registryStatus: IssuerStatus = 'Unknown';
  loadingStatus = false;

  lastAttestation: AttestResponse | null = null;

  constructor(private readonly issuerApi: IssuerApiService) {}

  async lookupStatus(): Promise<void> {
    if (!this.inputAddress.trim()) return;
    this.issuerAddress = this.inputAddress.trim();
    this.loadingStatus = true;
    this.registryStatus = await this.issuerApi.getIssuerStatus(this.issuerAddress);
    this.loadingStatus = false;
  }

  setView(v: ConsoleView): void {
    this.activeView = v;
  }

  onAttestSubmitted(result: AttestResponse): void {
    this.lastAttestation = result;
  }
}
