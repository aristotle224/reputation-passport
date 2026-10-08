/**
 * Example: write an attestation and read the worker's profile.
 *
 * Prerequisites:
 *   - A funded Stellar testnet account (get one at https://friendbot.stellar.org)
 *   - Contracts deployed with `make deploy-testnet` in contracts/
 *
 * Usage:
 *   export ISSUER_KEY=Sxxx...
 *   export WORKER_ADDRESS=Gxxx...
 *   export ATTESTATION_REGISTRY_ID=Cxxx...
 *   export ISSUER_REGISTRY_ID=Cxxx...
 *   export PROFILE_REGISTRY_ID=Cxxx...
 *   pnpm run example:attest
 */

import { ReputationClient } from '../src/index';
import * as crypto from 'crypto';

async function main() {
  const issuerKey = process.env['ISSUER_KEY'];
  const workerAddress = process.env['WORKER_ADDRESS'];

  if (!issuerKey) {
    console.error('ERROR: ISSUER_KEY env var is required');
    process.exit(1);
  }
  if (!workerAddress) {
    console.error('ERROR: WORKER_ADDRESS env var is required');
    process.exit(1);
  }

  const client = new ReputationClient({
    network: 'testnet',
    issuerKey,
    backendUrl: process.env['BACKEND_URL'],
  });

  // Generate a random evidence hash (in production this would be an IPFS/Arweave CID)
  const evidenceHash = crypto.randomBytes(32).toString('hex');

  console.log('Writing attestation to testnet...');
  console.log(`  subject:       ${workerAddress}`);
  console.log(`  jobType:       delivery`);
  console.log(`  rating:        480 / 500`);
  console.log(`  weight:        1`);
  console.log(`  evidenceHash:  ${evidenceHash}`);

  const txHash = await client.attest({
    subject: workerAddress,
    jobType: 'delivery',
    rating: 480,
    weight: 1,
    evidenceHash,
  });

  console.log(`\nAttestation written!  tx: ${txHash}`);

  console.log('\nReading profile...');
  const profile = await client.getProfile(workerAddress);
  console.log('Profile:', JSON.stringify(profile, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
