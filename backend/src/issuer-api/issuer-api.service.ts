import { Injectable, Logger } from '@nestjs/common';
import {
  BASE_FEE,
  Contract,
  Keypair,
  SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from '@stellar/stellar-sdk';
import { AttestDto, AttestResponseDto } from './dto/attest.dto';

const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015';
const SOROBAN_RPC_URL =
  process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';

/**
 * Simple API-key auth: ISSUER_API_KEYS env var holds a comma-separated list
 * of "address:apikey" pairs.
 */
function validateApiKey(issuerAddress: string, apiKey: string | undefined): boolean {
  const keys = process.env.ISSUER_API_KEYS ?? '';
  if (!keys) return true; // no keys configured — open for dev
  return keys.split(',').some((pair) => {
    const [addr, key] = pair.trim().split(':');
    return addr === issuerAddress && key === apiKey;
  });
}

@Injectable()
export class IssuerApiService {
  private readonly logger = new Logger(IssuerApiService.name);
  private readonly server = new SorobanRpc.Server(SOROBAN_RPC_URL, { allowHttp: true });

  /**
   * Build an attestation transaction.
   *
   * Default (trust-minimized) path: returns unsigned XDR for the platform to
   * sign and submit itself.
   *
   * Custodial path (custodialSign=true + SPONSOR_SECRET configured): signs
   * and submits on behalf of the issuer, returns txHash.
   */
  async buildAttest(dto: AttestDto, apiKey: string | undefined): Promise<AttestResponseDto> {
    if (!validateApiKey(dto.issuerAddress, apiKey)) {
      throw new Error('Unauthorized: invalid API key for issuer address');
    }

    const contractId = process.env.ATTESTATION_REGISTRY_ID ?? '';
    if (!contractId) throw new Error('ATTESTATION_REGISTRY_ID is not configured');

    const sourceAccount = await this.server.getAccount(dto.issuerAddress);
    const contract = new Contract(contractId);

    const jobTypeVariant = jobTypeToVariant(dto.jobType);
    const evidenceBytes = hexToBytes32(dto.evidenceHash);

    const args: xdr.ScVal[] = [
      nativeToScVal(dto.issuerAddress, { type: 'address' }),
      nativeToScVal(dto.subject, { type: 'address' }),
      xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(jobTypeVariant)]),
      nativeToScVal(dto.rating, { type: 'u32' }),
      nativeToScVal(dto.weight, { type: 'u32' }),
      xdr.ScVal.scvBytes(Buffer.from(evidenceBytes)),
    ];

    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('write_attestation', ...args))
      .setTimeout(30)
      .build();

    // Simulate to attach footprint.
    const simResult = await this.server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Simulation failed: ${simResult.error}`);
    }
    const prepared = SorobanRpc.assembleTransaction(tx, simResult).build();

    // Trust-minimized default: return unsigned XDR.
    if (!dto.custodialSign) {
      return { unsignedXdr: prepared.toXDR() };
    }

    // Custodial path: sign and submit using SPONSOR_SECRET.
    const sponsorSecret = process.env.SPONSOR_SECRET;
    if (!sponsorSecret) {
      throw new Error(
        'custodialSign=true but SPONSOR_SECRET is not configured. ' +
          'Use the unsigned XDR path instead.',
      );
    }
    prepared.sign(Keypair.fromSecret(sponsorSecret));
    const result = await this.server.sendTransaction(prepared);
    if (result.status === 'ERROR') {
      throw new Error(`Submit error: ${JSON.stringify(result.errorResult)}`);
    }
    return { txHash: result.hash };
  }

  /** Submit a pre-signed transaction XDR. */
  async submitSigned(signedXdr: string): Promise<{ txHash: string }> {
    const result = await this.server.sendTransaction(
      // Decode XDR back to a Transaction
      new (require('@stellar/stellar-sdk').Transaction)(signedXdr),
    );
    if (result.status === 'ERROR') {
      throw new Error(`Submit error: ${JSON.stringify(result.errorResult)}`);
    }
    return { txHash: result.hash };
  }
}

function jobTypeToVariant(jobType: string): string {
  const map: Record<string, string> = {
    delivery: 'Delivery',
    rideshare: 'Rideshare',
    'freelance-dev': 'FreelanceDev',
    other: 'Other',
  };
  return map[jobType] ?? 'Other';
}

function hexToBytes32(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(32);
  const len = Math.min(clean.length / 2, 32);
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
