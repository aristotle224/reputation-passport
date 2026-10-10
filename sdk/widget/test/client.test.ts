import { WidgetClient } from '../src/client';

// ── Mock fetch globally ────────────────────────────────────────────────────

const mockFetch = jest.fn();
(global as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

function mockOk(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function mockError(status: number) {
  mockFetch.mockResolvedValueOnce({ ok: false, status });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('WidgetClient', () => {
  const client = new WidgetClient({ backendUrl: 'https://api.example.com' });

  afterEach(() => mockFetch.mockReset());

  describe('getProfile()', () => {
    it('fetches the correct URL and returns the parsed profile', async () => {
      const mockProfile = {
        workerAddress: 'GABC',
        attestations: [],
        score: 4.6,
        breakdown: { delivery: 4.8 },
        attestationCount: 5,
        algorithmVersion: 'v1',
        proof: { description: '', attestationKeys: [] },
      };
      mockOk(mockProfile);

      const result = await client.getProfile('GABC');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/verification/profile/GABC',
      );
      expect(result.score).toBe(4.6);
      expect(result.algorithmVersion).toBe('v1');
    });

    it('throws on non-ok response', async () => {
      mockError(404);
      await expect(client.getProfile('GABC')).rejects.toThrow('API returned 404');
    });
  });

  describe('getScore()', () => {
    it('returns only score fields from the profile', async () => {
      mockOk({
        workerAddress: 'GABC',
        attestations: [{ issuerAddress: 'GISS', nonce: 1 }],
        score: 3.9,
        breakdown: { rideshare: 3.9 },
        attestationCount: 1,
        algorithmVersion: 'v1',
        proof: { description: '', attestationKeys: [] },
      });

      const score = await client.getScore('GABC');

      expect(score).toEqual({
        score: 3.9,
        breakdown: { rideshare: 3.9 },
        attestationCount: 1,
        algorithmVersion: 'v1',
      });
      // attestations list must not be present
      expect((score as unknown as { attestations?: unknown }).attestations).toBeUndefined();
    });
  });

  describe('getAttestations()', () => {
    it('returns the attestations array', async () => {
      const attestations = [
        { issuerAddress: 'GISS', subjectAddress: 'GABC', nonce: 1, jobType: 'delivery' },
      ];
      mockOk({ attestations });

      const result = await client.getAttestations('GABC');

      expect(result).toEqual(attestations);
    });

    it('returns empty array when attestations key is missing', async () => {
      mockOk({});
      const result = await client.getAttestations('GABC');
      expect(result).toEqual([]);
    });
  });

  describe('verifyAttestation()', () => {
    it('fetches the correct URL with nonce', async () => {
      mockOk({ found: true, attestation: { nonce: 7 }, onChainVerificationNote: 'note' });

      const result = await client.verifyAttestation('GABC', 'GISS', 7);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/verification/verify/GABC/GISS/7',
      );
      expect(result.found).toBe(true);
    });
  });

  describe('trailing-slash normalisation', () => {
    it('strips a trailing slash from backendUrl', async () => {
      const clientWithSlash = new WidgetClient({ backendUrl: 'https://api.example.com/' });
      mockOk({ workerAddress: 'G', attestations: [], score: 0, breakdown: {}, attestationCount: 0, algorithmVersion: 'v1', proof: { description: '', attestationKeys: [] } });
      await clientWithSlash.getProfile('G');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/verification/profile/G',
      );
    });
  });
});
