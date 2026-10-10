import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IssuerApiService } from '../../services/issuer-api';
import type { AttestRequest, AttestResponse, JobType } from '../../models/types';

@Component({
  selector: 'app-attest-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attest-form.html',
  styleUrl: './attest-form.css',
})
export class AttestFormComponent {
  /** Emitted on successful submission; payload is the API response. */
  readonly submitted = output<AttestResponse>();

  readonly jobTypes: JobType[] = ['delivery', 'rideshare', 'freelance-dev', 'other'];

  form: AttestRequest = {
    issuerAddress: '',
    subject: '',
    jobType: 'delivery',
    rating: 450,
    weight: 1,
    evidenceHash: '0000000000000000000000000000000000000000000000000000000000000000',
    custodialSign: false,
  };

  apiKey = '';
  submitting = false;
  result: AttestResponse | null = null;
  error: string | null = null;

  constructor(private readonly issuerApi: IssuerApiService) {}

  /** Rating slider is 0–500; display as 0.0–5.0. */
  get displayRating(): string {
    return (this.form.rating / 100).toFixed(1);
  }

  async submit(): Promise<void> {
    this.submitting = true;
    this.result = null;
    this.error = null;
    try {
      this.result = await this.issuerApi.attest(this.form, this.apiKey);
      this.submitted.emit(this.result);
    } catch (err) {
      this.error = (err as Error).message;
    } finally {
      this.submitting = false;
    }
  }

  reset(): void {
    this.result = null;
    this.error = null;
  }
}
