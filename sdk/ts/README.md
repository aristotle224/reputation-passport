# @reputation-passport/sdk

TypeScript SDK for [reputation-passport](../../README.md) — write attestations,
read worker profiles, and verify reputation scores on Stellar/Soroban.

## Install

```bash
pnpm add @reputation-passport/sdk
```

## Quick start

```ts
import { ReputationClient } from '@reputation-passport/sdk';

const client = new ReputationClient({
  network: 'testnet',
  issuerKey: process.env.ISSUER_KEY,   // Stellar secret key (Sxxx…)
  backendUrl: 'http://localhost:3000', // optional — falls back to direct chain read
});

// Write an attestation after a job completes
const txHash = await client.attest({
  subject: workerAddress,
  jobType: 'delivery',
  rating: 480,   // 0–500 scale
  weight: 1,
  evidenceHash: hash,  // hex-encoded 32 bytes (IPFS/Arweave CID)
});

// Read a worker's portable profile
const profile = await client.getProfile(workerAddress);
// { score: 4.8, breakdown: { delivery: 4.8 }, attestationCount: 132, algorithmVersion: 'v1' }
```

## Configuration

| Option | Required | Description |
|---|---|---|
| `network` | yes | `'testnet'` or `'mainnet'` |
| `issuerKey` | write ops | Stellar secret key for signing attest/revoke calls |
| `backendUrl` | no | Backend API base URL; enables versioned scored profiles |
| `contractIds` | no | Override deployed contract IDs (default: env vars) |

### Environment variables

```bash
ISSUER_REGISTRY_ID=Cxxx...
ATTESTATION_REGISTRY_ID=Cxxx...
PROFILE_REGISTRY_ID=Cxxx...
```

## API

### `client.attest(input)` → `Promise<string>`

Write an attestation for a worker. Returns the transaction hash.
Requires `issuerKey`.

### `client.getProfile(workerAddress)` → `Promise<ReputationScore>`

Get a worker's composite reputation score and per-category breakdown.
Routes through the backend verification API if `backendUrl` is set;
falls back to a direct chain read otherwise (trust-minimized path).

### `client.revokeAttestation(subject, nonce)` → `Promise<string>`

Revoke an existing attestation. To issue a correction, revoke the
original and write a new attestation — this preserves the full audit trail.

## Event parsing

The SDK exports typed parsers for on-chain events. These are also used by
the backend indexer:

```ts
import { parseAttestationWrittenEvent, parseIssuerRegisteredEvent } from '@reputation-passport/sdk';

const event = parseAttestationWrittenEvent(rawRpcEvent);
// { issuer, subject, nonce, jobType, rating, weight, timestamp } | null
```

## Fee-bump sponsorship

Workers never need to hold XLM. Use `SponsorshipClient` to have the backend
sponsor transaction fees:

```ts
import { SponsorshipClient } from '@reputation-passport/sdk';

const sponsor = new SponsorshipClient({ sponsorUrl: 'http://localhost:3000' });
const feeBumpXdr = await sponsor.requestFeeBump(signedInnerTxXdr);
```

## Running the example

```bash
export ISSUER_KEY=Sxxx...
export WORKER_ADDRESS=Gxxx...
export ATTESTATION_REGISTRY_ID=Cxxx...
pnpm run example:attest
```

## Tests

```bash
pnpm test
```
