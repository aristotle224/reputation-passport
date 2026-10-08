import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.module';
import { ScoringService } from '../scoring/scoring.service';
import {
  ProfileResponseDto,
  AttestationDto,
  VerifyResponseDto,
} from './dto/profile-response.dto';

@Injectable()
export class VerificationApiService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly scoringService: ScoringService,
  ) {}

  /**
   * Return a worker's attestations, composite score, and an on-chain proof
   * structure per README.md:
   * "public endpoint returning a worker's attestations, score, and a proof
   * the response matches on-chain state"
   */
  async getProfile(workerAddress: string): Promise<ProfileResponseDto> {
    const attestations = await this.getAttestations(workerAddress);
    const scoreResult = await this.scoringService.computeScore(workerAddress);

    // Proof: list the (issuer, subject, nonce) keys so consumers can verify
    // each attestation exists on chain via Soroban RPC getLedgerEntries.
    const attestationKeys = attestations.map((a) => ({
      issuer: a.issuerAddress,
      subject: a.subjectAddress,
      nonce: a.nonce,
    }));

    return {
      workerAddress,
      attestations,
      score: scoreResult.score,
      breakdown: scoreResult.breakdown,
      attestationCount: scoreResult.attestationCount,
      algorithmVersion: scoreResult.algorithmVersion,
      proof: {
        description:
          'Each attestation can be verified on-chain via Soroban RPC ' +
          'getLedgerEntries using the (issuer, subject, nonce) key tuple ' +
          'against the attestation-registry contract.',
        attestationKeys,
      },
    };
  }

  /** Return all indexed attestations (including revoked) for a worker. */
  async getAttestations(workerAddress: string): Promise<AttestationDto[]> {
    const { rows } = await this.pool.query(
      `SELECT issuer_address, subject_address, nonce, job_type, rating,
              weight, timestamp, evidence_hash, revoked, ledger_sequence
         FROM attestations
        WHERE subject_address = $1
        ORDER BY timestamp DESC`,
      [workerAddress],
    );

    return rows.map((r) => ({
      issuerAddress: r.issuer_address,
      subjectAddress: r.subject_address,
      nonce: Number(r.nonce),
      jobType: r.job_type,
      rating: r.rating,
      weight: r.weight,
      timestamp: Number(r.timestamp),
      evidenceHash: r.evidence_hash ?? '',
      revoked: r.revoked,
      ledgerSequence: r.ledger_sequence,
    }));
  }

  /** Look up a specific attestation by (subject, issuer, nonce). */
  async verifyAttestation(
    subject: string,
    issuer: string,
    nonce: number,
  ): Promise<VerifyResponseDto> {
    const { rows } = await this.pool.query(
      `SELECT issuer_address, subject_address, nonce, job_type, rating,
              weight, timestamp, evidence_hash, revoked, ledger_sequence
         FROM attestations
        WHERE subject_address = $1
          AND issuer_address  = $2
          AND nonce           = $3`,
      [subject, issuer, nonce],
    );

    const found = rows.length > 0;
    const row = rows[0];

    return {
      issuer,
      subject,
      nonce,
      found,
      attestation: found
        ? {
            issuerAddress: row.issuer_address,
            subjectAddress: row.subject_address,
            nonce: Number(row.nonce),
            jobType: row.job_type,
            rating: row.rating,
            weight: row.weight,
            timestamp: Number(row.timestamp),
            evidenceHash: row.evidence_hash ?? '',
            revoked: row.revoked,
            ledgerSequence: row.ledger_sequence,
          }
        : null,
      onChainVerificationNote:
        'To verify on-chain independently: call Soroban RPC getLedgerEntries ' +
        'with the DataKey::Attestation(subject, issuer, nonce) key against the ' +
        'attestation-registry contract ID from contracts/.testnet-contract-ids.',
    };
  }
}
