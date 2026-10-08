/**
 * Unit tests for ReputationClient with mocked Soroban RPC.
 */

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk') as Record<string, unknown>;
  return {
    ...actual,
    SorobanRpc: {
      ...((actual['SorobanRpc'] as Record<string, unknown>) ?? {}),
      Server: jest.fn().mockImplementation(() => ({
        getAccount: jest.fn().mockResolvedValue({
          accountId: () => 'GDUMMYACCOUNT',
          sequence: '100',
          incrementSequenceNumber: jest.fn(),
        }),
        simulateTransaction: jest.fn().mockResolvedValue({
          result: { retval: null },
          transactionData: '',
          minResourceFee: '100',
        }),
        sendTransaction: jest.fn().mockResolvedValue({
          status: 'PENDING',
          hash: 'mock-tx-hash-abc123',
        }),
        getTransaction: jest.fn().mockResolvedValue({
          status: 'SUCCESS',
          returnValue: null,
        }),
      })),
      Api: {
        isSimulationError: jest.fn().mockReturnValue(false),
        isSimulationSuccess: jest.fn().mockReturnValue(true),
        GetTransactionStatus: { SUCCESS: 'SUCCESS', FAILED: 'FAILED', NOT_FOUND: 'NOT_FOUND' },
      },
      assembleTransaction: jest.fn().mockImplementation(() => ({
        build: () => ({
          sign: jest.fn(),
          toXDR: jest.fn().mockReturnValue('mock-xdr'),
        }),
      })),
    },
  };
});

import { ReputationClient } from '../src/client';

describe('ReputationClient', () => {
  describe('constructor', () => {
    it('creates a client with minimal config', () => {
      const client = new ReputationClient({ network: 'testnet' });
      expect(client).toBeInstanceOf(ReputationClient);
    });

    it('creates a client with full config', () => {
      const client = new ReputationClient({
        network: 'testnet',
        issuerKey: 'SCZANGBA5AKIA4MXKPTLBGXF4WBNBHYEXS7HLO6BCMZEZNWBEVULRK2T',
        backendUrl: 'http://localhost:3000',
        contractIds: {
          attestationRegistry: 'C123',
          issuerRegistry: 'C456',
          profileRegistry: 'C789',
        },
      });
      expect(client).toBeInstanceOf(ReputationClient);
    });
  });

  describe('attest()', () => {
    it('throws if no issuerKey is configured', async () => {
      const client = new ReputationClient({ network: 'testnet' });
      await expect(
        client.attest({
          subject: 'GDUMMYWORKER',
          jobType: 'delivery',
          rating: 480,
          weight: 1,
          evidenceHash: 'a'.repeat(64),
        }),
      ).rejects.toThrow('issuerKey is required');
    });

    it('throws if attestationRegistry contract ID is missing', async () => {
      const client = new ReputationClient({
        network: 'testnet',
        issuerKey: 'SCZANGBA5AKIA4MXKPTLBGXF4WBNBHYEXS7HLO6BCMZEZNWBEVULRK2T',
      });
      await expect(
        client.attest({
          subject: 'GDUMMYWORKER',
          jobType: 'delivery',
          rating: 480,
          weight: 1,
          evidenceHash: 'a'.repeat(64),
        }),
      ).rejects.toThrow('attestationRegistry contract ID is not configured');
    });
  });

  describe('getProfile()', () => {
    it('calls backend URL when backendUrl is configured', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          score: 4.8,
          breakdown: { delivery: 4.8 },
          attestationCount: 10,
          algorithmVersion: 'v1',
        }),
      });
      global.fetch = fetchMock as typeof fetch;

      const client = new ReputationClient({
        network: 'testnet',
        backendUrl: 'http://localhost:3000',
      });

      const profile = await client.getProfile('GDUMMYWORKER');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/verification/profile/GDUMMYWORKER',
      );
      expect(profile.score).toBe(4.8);
      expect(profile.algorithmVersion).toBe('v1');
    });

    it('falls back to chain read when backend call fails', async () => {
      const fetchMock = jest.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = fetchMock as typeof fetch;

      const client = new ReputationClient({
        network: 'testnet',
        backendUrl: 'http://unreachable',
        contractIds: { attestationRegistry: 'C_MOCK', issuerRegistry: '', profileRegistry: '' },
      });

      const profile = await client.getProfile('GDUMMYWORKER');
      expect(profile).toHaveProperty('score');
      expect(profile).toHaveProperty('algorithmVersion');
    });

    it('returns zero score when no backendUrl and no contract ID', async () => {
      const client = new ReputationClient({ network: 'testnet' });
      const profile = await client.getProfile('GDUMMYWORKER');
      expect(profile.score).toBe(0);
      expect(profile.attestationCount).toBe(0);
    });
  });
});
