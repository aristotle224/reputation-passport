import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { IssuerStatus } from '../../models/types';

@Component({
  selector: 'app-registry-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './registry-status.html',
  styleUrl: './registry-status.css',
})
export class RegistryStatusComponent {
  readonly issuerAddress = input.required<string>();
  readonly status = input.required<IssuerStatus>();
  readonly loading = input(false);

  get statusClass(): string {
    const map: Record<IssuerStatus, string> = {
      Active: 'active',
      Suspended: 'suspended',
      Delisted: 'delisted',
      Unknown: 'unknown',
    };
    return map[this.status()] ?? 'unknown';
  }

  get statusIcon(): string {
    const map: Record<IssuerStatus, string> = {
      Active: '✅',
      Suspended: '⚠️',
      Delisted: '🚫',
      Unknown: '❓',
    };
    return map[this.status()] ?? '❓';
  }

  shortAddress(addr: string): string {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 10)}…${addr.slice(-6)}`;
  }
}
