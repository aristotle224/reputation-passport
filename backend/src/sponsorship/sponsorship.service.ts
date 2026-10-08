import { Injectable, Logger } from '@nestjs/common';
import {
  FeeBumpTransaction,
  Keypair,
  SorobanRpc,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

const SOROBAN_RPC_URL =
  process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015';
const FEE_BUMP_BASE_FEE = '1000'; // stroops

/**
 * Fee-bump sponsorship service.
 *
 * Workers never need to hold XLM. The backend sponsor account wraps inner
 * transactions in Stellar fee-bump transactions so workers' attestations land
 * on chain without requiring a funded wallet.
 *
 * The SDK-side stub (sdk/ts/src/sponsorship.ts) calls this service's endpoints.
 *
 * Requires SPONSOR_SECRET env var to be set to a funded Stellar secret key.
 */
@Injectable()
export class SponsorshipService {
  private readonly logger = new Logger(SponsorshipService.name);
  private readonly server = new SorobanRpc.Server(SOROBAN_RPC_URL, { allowHttp: true });

  /**
   * Wrap a signed inner transaction XDR in a fee-bump envelope.
   * The inner transaction must already be signed by the originator.
   * Returns the fee-bump transaction XDR (base64-encoded envelope).
   */
  async wrapFeeBump(innerTxXdr: string): Promise<string> {
    const sponsorSecret = process.env.SPONSOR_SECRET;
    if (!sponsorSecret) {
      throw new Error(
        'SponsorshipService: SPONSOR_SECRET is not configured. ' +
          'Set it to a funded Stellar secret key.',
      );
    }

    const sponsorKeypair = Keypair.fromSecret(sponsorSecret);
    const innerTx = new Transaction(innerTxXdr, NETWORK_PASSPHRASE);

    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      sponsorKeypair,
      FEE_BUMP_BASE_FEE,
      innerTx,
      NETWORK_PASSPHRASE,
    );

    feeBumpTx.sign(sponsorKeypair);
    return feeBumpTx.toXDR();
  }

  /**
   * Wrap the inner transaction in a fee-bump envelope and submit it.
   * Returns the submitted transaction hash.
   */
  async submitFeeBump(innerTxXdr: string): Promise<string> {
    const feeBumpXdr = await this.wrapFeeBump(innerTxXdr);
    const feeBumpTx = new FeeBumpTransaction(feeBumpXdr, NETWORK_PASSPHRASE);

    const result = await this.server.sendTransaction(feeBumpTx);
    if (result.status === 'ERROR') {
      throw new Error(
        `SponsorshipService: fee-bump submit failed: ${JSON.stringify(result.errorResult)}`,
      );
    }

    this.logger.log(`Fee-bump submitted: ${result.hash}`);
    return result.hash;
  }
}
