import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { WorkerProfile } from '../../models/types';

@Component({
  selector: 'app-score-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './score-card.html',
  styleUrl: './score-card.css',
})
export class ScoreCardComponent {
  readonly profile = input.required<WorkerProfile>();

  get breakdownEntries(): { category: string; score: number }[] {
    const b = this.profile().breakdown;
    return Object.entries(b).map(([category, score]) => ({ category, score }));
  }

  /** Convert 0–5 score to a star-fill width percentage. */
  starPercent(score: number): number {
    return Math.round((score / 5) * 100);
  }

  /** Friendly display name for a job type. */
  categoryLabel(cat: string): string {
    const labels: Record<string, string> = {
      delivery: 'Delivery',
      rideshare: 'Rideshare',
      'freelance-dev': 'Freelance Dev',
      other: 'Other',
    };
    return labels[cat] ?? cat;
  }
}
