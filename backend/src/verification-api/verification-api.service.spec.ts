import { Test, TestingModule } from '@nestjs/testing';
import { VerificationApiService } from './verification-api.service';
import { DATABASE_POOL } from '../database/database.module';
import { ScoringService } from '../scoring/scoring.service';

const MOCK_ROWS = [
  {
    issuer_address: 'GISSUER1',
    subject_address: 'GWORKER1',
    nonce: '0',
    job_type: 'delivery',
    rating: 480,
    weight: 1,
    timestamp: '1700000000',
    evidence_hash: 'abc',
    revoked: false,
    ledger_sequence: 100,
  },
];

describe('VerificationApiService', () => {
  let service: VerificationApiService;
  let mockPool: { query: jest.Mock };
  let mockScoring: { computeScore: jest.Mock };

  beforeEach(async () => {
    mockPool = { query: jest.fn().mockResolvedValue({ rows: MOCK_ROWS }) };
    mockScoring = {
      computeScore: jest.fn().mockResolvedValue({
        score: 4.8,
        breakdown: { delivery: 4.8 },
        attestationCount: 1,
        algorithmVersion: 'v1',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationApiService,
        { provide: DATABASE_POOL, useValue: mockPool },
        { provide: ScoringService, useValue: mockScoring },
      ],
    }).compile();

    service = module.get<VerificationApiService>(VerificationApiService);
  });

  describe('getProfile()', () => {
    it('returns score and attestations for a known worker', async () => {
      const result = await service.getProfile('GWORKER1');
      expect(result.score).toBe(4.8);
      expect(result.attestationCount).toBe(1);
      expect(result.algorithmVersion).toBe('v1');
      expect(result.attestations).toHaveLength(1);
    });

    it('includes an on-chain proof with attestation keys', async () => {
      const result = await service.getProfile('GWORKER1');
      expect(result.proof).toHaveProperty('attestationKeys');
      expect(result.proof.attestationKeys[0]).toMatchObject({
        issuer: 'GISSUER1',
        subject: 'GWORKER1',
        nonce: 0,
      });
    });
  });

  describe('getAttestations()', () => {
    it('maps DB rows to AttestationDto shape', async () => {
      const attestations = await service.getAttestations('GWORKER1');
      expect(attestations).toHaveLength(1);
      expect(attestations[0]).toMatchObject({
        issuerAddress: 'GISSUER1',
        subjectAddress: 'GWORKER1',
        nonce: 0,
        jobType: 'delivery',
        rating: 480,
      });
    });
  });

  describe('verifyAttestation()', () => {
    it('returns found=true when attestation exists', async () => {
      const result = await service.verifyAttestation('GWORKER1', 'GISSUER1', 0);
      expect(result.found).toBe(true);
      expect(result.attestation).not.toBeNull();
      expect(result.onChainVerificationNote).toContain('getLedgerEntries');
    });

    it('returns found=false when attestation does not exist', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const result = await service.verifyAttestation('GWORKER1', 'GISSUER1', 99);
      expect(result.found).toBe(false);
      expect(result.attestation).toBeNull();
    });
  });
});
