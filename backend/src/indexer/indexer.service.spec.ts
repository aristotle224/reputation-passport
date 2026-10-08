import { Test, TestingModule } from '@nestjs/testing';
import { IndexerService, AttestationWrittenEvent, IssuerRegisteredEvent } from './indexer.service';
import { DATABASE_POOL } from '../database/database.module';

describe('IndexerService', () => {
  let service: IndexerService;
  let mockPool: { query: jest.Mock };

  beforeEach(async () => {
    mockPool = { query: jest.fn().mockResolvedValue({ rows: [{ last_indexed_ledger: 0 }] }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndexerService,
        { provide: DATABASE_POOL, useValue: mockPool },
      ],
    }).compile();

    service = module.get<IndexerService>(IndexerService);
  });

  describe('persistAttestation()', () => {
    it('inserts an attestation row with correct parameters', async () => {
      const event: AttestationWrittenEvent = {
        issuer: 'GISSUER1234',
        subject: 'GWORKER5678',
        nonce: 0n,
        jobType: 'delivery',
        rating: 480,
        weight: 1,
        timestamp: 1700000000,
      };

      await service.persistAttestation(event, 1234);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO attestations'),
        ['GISSUER1234', 'GWORKER5678', '0', 'delivery', 480, 1, '1700000000', 1234],
      );
    });

    it('is idempotent — ON CONFLICT DO NOTHING prevents duplicates', async () => {
      const event: AttestationWrittenEvent = {
        issuer: 'GISSUER1234',
        subject: 'GWORKER5678',
        nonce: 0n,
        jobType: 'delivery',
        rating: 480,
        weight: 1,
        timestamp: 1700000000,
      };

      await service.persistAttestation(event, 1234);
      await service.persistAttestation(event, 1234); // second call is a duplicate

      // Both calls use ON CONFLICT DO NOTHING — the SQL must contain it
      const calls = mockPool.query.mock.calls.filter((c) =>
        typeof c[0] === 'string' && c[0].includes('ON CONFLICT'),
      );
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('persistIssuer()', () => {
    it('inserts an issuer row with correct parameters', async () => {
      const event: IssuerRegisteredEvent = {
        issuer: 'GISSUER1234',
        stake: 200n,
      };

      await service.persistIssuer(event, 1000);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO issuers'),
        ['GISSUER1234', '200', 1000],
      );
    });
  });

  describe('getStatus()', () => {
    it('returns status with zeroed counts when tables are empty', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: 0 }] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      const status = await service.getStatus();
      expect(status).toHaveProperty('lastIndexedLedger');
      expect(status).toHaveProperty('attestationCount');
      expect(status).toHaveProperty('issuerCount');
    });
  });
});
