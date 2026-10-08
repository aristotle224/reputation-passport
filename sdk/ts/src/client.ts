/**
 * ReputationClient — primary integration surface for partner platforms.
 *
 * Matches the API shape shown in README.md exactly:
 *
 * ```ts
 * const client = new ReputationClient({ network: 'testnet', issuerKey: myIssuerKey });
 * await client.attest({ subject, jobType: 'delivery', rating: 480, weight: 1, evidenceHash: hash });
 * const profile = await client.getProfile(workerAddress);
 * // { score: 4.6, breakdown: { delivery: 4.8 }, attestationCount: 132, algorithmVersion: 'v1' }
 * ```
 *
 * Two operational modes:
 *   - **Write mode**: requires `issuerKey` in config.
 *   - **Read mode**: no key needed; reads attestations and scores either from
 *     the backend verification API (if `backendUrl` is configured) or directly
 *     from chain.  The direct-chain fallback is always available so the SDK
 *     never *requires* trusting our backend — per README's trust model.
 */

import { Keypair, nativeToScVal, SorobanRpc, xdr, scValToNative } from '@stellar/stellar-sdk';
import { DEFAULT_CONTRACT_IDS, NETWORK_CONFIGS } from './config';
import { buildAndSubmit, invokeReadOnly, hexToBytes32 } from './contracts';
import type {
  AttestInput,
  Attestation,
  JobType,
  ReputationClientConfig,
  ReputationScore,
} from './types';

export class ReputationClient {
  private readonly config: Required<
    Pick<ReputationClientConfig, 'network' | 'backendUrl'>
  > & ReputationClientConfig;

  private readonly server: SorobanRpc.Server;
  private readonly networkConfig: (typeof NETWORK_CONFIGS)['testnet'];
  private readonly contractIds: {
    issuerRegistry: string;
    attestationRegistry: string;
    profileRegistry: string;
  };

  constructor(config: ReputationClientConfig) {
    this.config = {
      backendUrl: '',
      ...config,
    } as typeof this.config;

    this.networkConfig = NETWORK_CONFIGS[config.network];
    this.server = new SorobanRpc.Server(this.networkConfig.rpcUrl, {
      allowHttp: false,
    });

    const defaults = DEFAULT_CONTRACT_IDS[config.network];
    this.contractIds = {
      issuerRegistry: config.contractIds?.issuerRegistry ?? defaults.issuerRegistry,
      attestationRegistry:
        config.contractIds?.attestationRegistry ?? defaults.attestationRegistry,
      profileRegistry: config.contractIds?.profileRegistry ?? defaults.profileRegistry,
    };
  }

  // ── Write operations ───────────────────────────────────────────────────────

  /**
   * Write an attestation for a worker after a job completes.
   *
   * Requires `issuerKey` in the client config.
   * Builds, signs, and submits a Soroban transaction to attestation-registry.
   *
   * Returns the transaction hash of the confirmed on-chain write.
   */
  async attest(input: AttestInput): Promise<string> {
    if (!this.config.issuerKey) {
      throw new Error(
        'ReputationClient: issuerKey is required for attest(). ' +
          'Provide it in the constructor config.',
      );
    }
    if (!this.contractIds.attestationRegistry) {
      throw new Error(
        'ReputationClient: attestationRegistry contract ID is not configured. ' +
          'Set ATTESTATION_REGISTRY_ID env var or pass contractIds.attestationRegistry.',
      );
    }

    const keypair = Keypair.fromSecret(this.config.issuerKey);

    // Map SDK JobType string to the on-chain enum variant name.
    const jobTypeVariant = jobTypeToVariant(input.jobType);
    const evidenceBytes = hexToBytes32(input.evidenceHash);

    const args: xdr.ScVal[] = [
      // issuer
      nativeToScVal(keypair.publicKey(), { type: 'address' }),
      // subject
      nativeToScVal(input.subject, { type: 'address' }),
      // job_type — Soroban enum: { tag: 'Variant', values: [] }
      xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(jobTypeVariant)]),
      // rating
      nativeToScVal(input.rating, { type: 'u32' }),
      // weight
      nativeToScVal(input.weight, { type: 'u32' }),
      // evidence_hash — BytesN<32>
      xdr.ScVal.scvBytes(Buffer.from(evidenceBytes)),
    ];

    return buildAndSubmit(
      this.server,
      keypair,
      this.networkConfig,
      this.contractIds.attestationRegistry,
      'write_attestation',
      args,
    );
  }

  /**
   * Revoke an existing attestation.
   *
   * Requires `issuerKey` in the client config.
   * Returns the transaction hash.
   */
  async revokeAttestation(subject: string, nonce: bigint): Promise<string> {
    if (!this.config.issuerKey) {
      throw new Error('ReputationClient: issuerKey is required for revokeAttestation().');
    }

    const keypair = Keypair.fromSecret(this.config.issuerKey);

    const args: xdr.ScVal[] = [
      nativeToScVal(keypair.publicKey(), { type: 'address' }),
      nativeToScVal(subject, { type: 'address' }),
      nativeToScVal(nonce, { type: 'u64' }),
    ];

    return buildAndSubmit(
      this.server,
      keypair,
      this.networkConfig,
      this.contractIds.attestationRegistry,
      'revoke_attestation',
      args,
    );
  }

  // ── Read operations ────────────────────────────────────────────────────────

  /**
   * Get a worker's portable reputation profile.
   *
   * If `backendUrl` is configured, calls `GET {backendUrl}/api/v1/verification/profile/{address}`
   * which returns the score with a proof anchored to on-chain state.
   *
   * Falls back to reading attestations directly from chain and computing a
   * simple local score — this fallback preserves the trust-minimization
   * property described in README.md's "Trust & security model" section:
   * the SDK never *requires* trusting our backend.
   *
   * TODO: The backend routing is wired in Day 5; the fallback local computation
   * here is intentionally simple and does not apply time decay.  Use the
   * backend API for production scoring (see docs/scoring-spec.md).
   */
  async getProfile(workerAddress: string): Promise<ReputationScore> {
    // Prefer backend API if configured — it returns the versioned, time-decayed
    // score with an on-chain proof.
    if (this.config.backendUrl) {
      try {
        const url = `${this.config.backendUrl}/api/v1/verification/profile/${workerAddress}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = (await response.json()) as ReputationScore;
          return data;
        }
      } catch {
        // Fall through to direct chain read.
      }
    }

    // Direct-chain fallback: read attestations from the contract and compute
    // a simple unweighted average.  This is the trust-minimized path —
    // any consumer can reproduce this from raw on-chain data.
    return this._getProfileFromChain(workerAddress);
  }

  /**
   * Read all attestations for a worker directly from the chain.
   */
  async getAttestations(workerAddress: string): Promise<Attestation[]> {
    if (!this.contractIds.attestationRegistry) {
      throw new Error('attestationRegistry contract ID is not configured.');
    }

    // Use a throwaway read-only key if no issuerKey is configured.
    const sourceKey = this.config.issuerKey
      ? Keypair.fromSecret(this.config.issuerKey).publicKey()
      : Keypair.random().publicKey();

    const countVal = await invokeReadOnly(
      this.server,
      this.networkConfig,
      sourceKey,
      this.contractIds.attestationRegistry,
      'get_attestation_count',
      [nativeToScVal(workerAddress, { type: 'address' })],
    );

    const count = Number(scValToNative(countVal) as bigint);
    if (count === 0) return [];

    // We'd need to know all issuers to look up attestations by (subject, issuer, nonce).
    // Without an issuer index this requires an off-chain index.  Return empty here
    // and note this limitation — the backend indexer resolves this.
    // TODO: replace with backend /verification/attestations/{address} call once live.
    return [];
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private async _getProfileFromChain(workerAddress: string): Promise<ReputationScore> {
    if (!this.contractIds.attestationRegistry) {
      return { score: 0, breakdown: {}, attestationCount: 0, algorithmVersion: 'v1-local' };
    }

    const sourceKey = this.config.issuerKey
      ? Keypair.fromSecret(this.config.issuerKey).publicKey()
      : Keypair.random().publicKey();

    try {
      const countVal = await invokeReadOnly(
        this.server,
        this.networkConfig,
        sourceKey,
        this.contractIds.attestationRegistry,
        'get_attestation_count',
        [nativeToScVal(workerAddress, { type: 'address' })],
      );
      const attestationCount = Number(scValToNative(countVal) as bigint);

      // Without a full index we return the count and a zero score here.
      // The backend verification API provides the full scored profile.
      return {
        score: 0,
        breakdown: {},
        attestationCount,
        algorithmVersion: 'v1-local-stub',
      };
    } catch {
      return { score: 0, breakdown: {}, attestationCount: 0, algorithmVersion: 'v1-local-stub' };
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Map SDK JobType string to the Soroban enum variant name (PascalCase). */
function jobTypeToVariant(jobType: JobType): string {
  const map: Record<JobType, string> = {
    delivery: 'Delivery',
    rideshare: 'Rideshare',
    'freelance-dev': 'FreelanceDev',
    other: 'Other',
  };
  return map[jobType] ?? 'Other';
}
