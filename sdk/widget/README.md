# @reputation-passport/widget

Browser-safe, read-only reputation client for the reputation-passport protocol.

This package is the embeddable half of the SDK split described in README.md:

> **`sdk/widget`** — read-only, browser-safe client for embeddable reputation
> badges. No wallet or signing required.

It wraps the backend verification API with no `stellar-sdk` dependency and no
signing code — safe to bundle in any browser environment.

## Install

```bash
pnpm add @reputation-passport/widget
```

## Usage

```ts
import { WidgetClient } from '@reputation-passport/widget';

const client = new WidgetClient({
  backendUrl: 'https://api.reputation-passport.example.com',
});

// Full profile (score + attestations + on-chain proof keys)
const profile = await client.getProfile(workerAddress);
// { score: 4.6, breakdown: { delivery: 4.8 }, attestationCount: 132, ... }

// Score only (for a compact badge)
const score = await client.getScore(workerAddress);

// All attestations
const attestations = await client.getAttestations(workerAddress);

// Verify a specific attestation
const { found, onChainVerificationNote } = await client.verifyAttestation(
  workerAddress,
  issuerAddress,
  nonce,
);
```

## Relationship to `@reputation-passport/sdk`

| Feature | `@reputation-passport/sdk` | `@reputation-passport/widget` |
|---|---|---|
| Read profile/attestations | ✅ | ✅ |
| Write attestations | ✅ | ❌ |
| Revoke attestations | ✅ | ❌ |
| Browser-safe (no Node deps) | ❌ | ✅ |
| Requires signing key | Yes (write ops) | No |

Use `@reputation-passport/sdk` on server-side platform integrations.
Use `@reputation-passport/widget` in browser bundles and embeddable badges.

## API

### `new WidgetClient(config)`

| Option | Type | Description |
|---|---|---|
| `backendUrl` | `string` | Base URL of the reputation-passport backend API |

### `client.getProfile(workerAddress)` → `WorkerProfile`
Full profile: score, attestations, per-category breakdown, and proof keys.

### `client.getScore(workerAddress)` → `ReputationScore`
Composite score and breakdown only — no attestation list.

### `client.getAttestations(workerAddress)` → `AttestationRecord[]`
All attestations (including revoked). Filter on `revoked` as needed.

### `client.verifyAttestation(workerAddress, issuerAddress, nonce)` → `VerifyResult`
Look up a specific attestation and receive an on-chain verification note for
independent confirmation via Soroban RPC.

## Trust model

This client calls the backend verification API. Per README.md's trust model:

> "A consuming platform [should never] blindly trust our database."

Every profile response includes a `proof.attestationKeys` array. Use those keys
with Soroban RPC `getLedgerEntries` against the `attestation-registry` contract
to independently confirm each record exists on-chain without relying on the
backend.
