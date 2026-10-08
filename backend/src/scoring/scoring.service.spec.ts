import { Test, TestingModule } from '@nestjs/testing';
import { ScoringService } from './scoring.service';
import { DATABASE_POOL } from '../database/database.module';

function makeRow(job_type: string, rating: number, weight: number, ageSeconds = 0) {
  const timestamp = Math.floor(Date.now() / 1000) - ageSeconds;
  return { job_type, rating, weight, timestamp: String(timestamp) };
}

describe('ScoringService', () => {
  let service: ScoringService;
  let mockPool: { query: jest.Mock };

  beforeEach(async () => {
    mockPool = { query: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        { provide: DATABASE_POOL, useValue: mockPool },
      ],
    }).compile();
    service = module.get<ScoringService>(ScoringService);
  });

  it('returns score 0 with no attestations', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    const result = await service.computeScore('GWORKER');
    expect(result.score).toBe(0);
    expect(result.attestationCount).toBe(0);
    expect(result.breakdown).toEqual({});
    expect(result.algorithmVersion).toBe('v1');
  });

  it('computes correct score for a single attestation', async () => {
    mockPool.query.mockResolvedValue({ rows: [makeRow('delivery', 400, 1)] });
    const result = await service.computeScore('GWORKER');
    expect(result.score).toBeCloseTo(4.0, 1);
    expect(result.breakdown['delivery']).toBeCloseTo(4.0, 1);
    expect(result.attestationCount).toBe(1);
  });

  it('computes weighted average across two attestations', async () => {
    // (2*5.0 + 1*3.0) / 3 = 13/3 ≈ 4.33
    mockPool.query.mockResolvedValue({
      rows: [makeRow('delivery', 500, 2), makeRow('delivery', 300, 1)],
    });
    const result = await service.computeScore('GWORKER');
    expect(result.score).toBeCloseTo(4.33, 1);
    expect(result.attestationCount).toBe(2);
  });

  it('produces per-category breakdown', async () => {
    mockPool.query.mockResolvedValue({
      rows: [makeRow('delivery', 480, 1), makeRow('rideshare', 420, 1)],
    });
    const result = await service.computeScore('GWORKER');
    expect(result.breakdown['delivery']).toBeCloseTo(4.8, 1);
    expect(result.breakdown['rideshare']).toBeCloseTo(4.2, 1);
  });

  it('time decay reduces influence of old attestations', async () => {
    const OLD = 730 * 86400; // 2 years in seconds
    mockPool.query.mockResolvedValue({
      rows: [
        makeRow('delivery', 500, 1, 0),   // recent — rating 5.0
        makeRow('delivery', 100, 1, OLD), // 2 years old — rating 1.0, decayed
      ],
    });
    const result = await service.computeScore('GWORKER');
    // Recent high-rating attestation should dominate; score > 3.0
    expect(result.score).toBeGreaterThan(3.0);
  });

  it('SQL query filters revoked attestations', async () => {
    mockPool.query.mockResolvedValue({ rows: [makeRow('delivery', 480, 1)] });
    await service.computeScore('GWORKER');
    const sql = mockPool.query.mock.calls[0][0] as string;
    expect(sql).toContain('revoked = false');
  });

  it('algorithm version is always v1', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    const result = await service.computeScore('GWORKER');
    expect(result.algorithmVersion).toBe('v1');
  });
});
