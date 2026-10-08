/**
 * Network configuration and default contract IDs.
 *
 * Contract IDs are populated from environment variables when running in
 * Node.js.  After deploying contracts with `make deploy-testnet`, copy the
 * IDs from contracts/.testnet-contract-ids into these env vars (or pass them
 * explicitly via ReputationClientConfig.contractIds).
 */

export interface NetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl: string;
}

export const NETWORK_CONFIGS: Record<'testnet' | 'mainnet', NetworkConfig> = {
  testnet: {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
  },
  mainnet: {
    rpcUrl: 'https://soroban-mainnet.stellar.org',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    horizonUrl: 'https://horizon.stellar.org',
  },
};

/**
 * Default contract IDs loaded from environment variables.
 * Override via ReputationClientConfig.contractIds if needed.
 */
export const DEFAULT_CONTRACT_IDS: Record<
  'testnet' | 'mainnet',
  { issuerRegistry: string; attestationRegistry: string; profileRegistry: string }
> = {
  testnet: {
    issuerRegistry: process.env['ISSUER_REGISTRY_ID'] ?? '',
    attestationRegistry: process.env['ATTESTATION_REGISTRY_ID'] ?? '',
    profileRegistry: process.env['PROFILE_REGISTRY_ID'] ?? '',
  },
  mainnet: {
    issuerRegistry: '',
    attestationRegistry: '',
    profileRegistry: '',
  },
};
