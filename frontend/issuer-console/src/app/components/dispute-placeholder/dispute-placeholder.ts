import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * DisputePlaceholderComponent — placeholder UI for the dispute review tab.
 *
 * Dispute resolution is an intentionally unresolved open design decision in
 * README.md ("Open design decisions" section). This component provides the
 * shell so the issuer console is complete, without implementing any resolution
 * logic. See README.md for the options under consideration.
 */
@Component({
  selector: 'app-dispute-placeholder',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dispute-placeholder.html',
  styleUrl: './dispute-placeholder.css',
})
export class DisputePlaceholderComponent {}
