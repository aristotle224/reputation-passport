import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { AttestationRecord } from '../../models/types';

@Component({
  selector: 'app-attestation-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attestation-list.html',
  styleUrl: './attestation-list.css',
})
export class AttestationListComponent {
  readonly attestations = input.required<AttestationRecord[]>();

  /** Toggle to show/hide revoked attestations. */
  showRevoked = false;

  get visible(): AttestationRecord[] {
    if (this.showRevoked) return this.attestations();
    return this.attestations().filter((a) => !a.revoked);
  }

  get revokedCount(): number {
    return this.attestations().filter((a) => a.revoked).length;
  }

  /** Convert on-chain 0–500 rating to 0–5.0 string. */
  formatRating(rating: number): string {
    return (rating / 100).toFixed(1);
  }

  /** Format Unix timestamp as a short date string. */
  formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  categoryLabel(cat: string): string {
    const labels: Record<string, string> = {
      delivery: 'Delivery',
      rideshare: 'Rideshare',
      'freelance-dev': 'Freelance Dev',
      other: 'Other',
    };
    return labels[cat] ?? cat;
  }

  /** Truncate a long address to first 8 + last 6 chars. */
  shortAddress(addr: string): string {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
  }
}
