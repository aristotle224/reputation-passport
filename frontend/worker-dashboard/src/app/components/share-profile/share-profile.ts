import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-share-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './share-profile.html',
  styleUrl: './share-profile.css',
})
export class ShareProfileComponent {
  readonly workerAddress = input.required<string>();

  copied = false;

  get shareUrl(): string {
    const base = window.location.origin;
    return `${base}/profile/${this.workerAddress()}`;
  }

  get qrUrl(): string {
    // Use a public QR generator service to avoid adding a QR library dependency.
    return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(this.shareUrl)}`;
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.shareUrl).then(() => {
      this.copied = true;
      setTimeout(() => { this.copied = false; }, 2000);
    });
  }
}
