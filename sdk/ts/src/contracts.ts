/**
 * Low-level contract invocation helpers.
 *
 * These wrap @stellar/stellar-sdk's SorobanRpc, TransactionBuilder, and
 * Contract classes to provide a simple buildAndSubmit / invokeReadOnly surface.
 * The ReputationClient uses these rather than calling stellar-sdk directly.
 */

import {
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  SorobanRpc,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  xdr,
  scValToNative,
} from '@stellar/stellar-sdk';
import type { NetworkConfig } from './config';

export type ScValArg = xdr.ScVal;

/**
 * Build a Soroban transaction invoking `method` on `contractId` with `args`,
 * simulate it to get the footprint, then submit and wait for confirmation.
 *
 * Returns the submitted transaction hash.
 */
export async function buildAndSubmit(
  server: SorobanRpc.Server,
  keypair: Keypair,
  networkConfig: NetworkConfig,
  contractId: string,
  method: string,
  args: ScValArg[],
): Promise<string> {
  const sourceAccount = await server.getAccount(keypair.publicKey());
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: networkConfig.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // Simulate to get the footprint (required before submission).
  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
  preparedTx.sign(keypair);

  const sendResult = await server.sendTransaction(preparedTx);
  if (sendResult.status === 'ERROR') {
    throw new Error(`Submit failed: ${JSON.stringify(sendResult.errorResult)}`);
  }

  // Poll until the transaction is confirmed or fails.
  const txHash = sendResult.hash;
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const status = await server.getTransaction(txHash);
    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return txHash;
    }
    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${txHash}`);
    }
  }
  throw new Error(`Transaction timed out: ${txHash}`);
}

/**
 * Invoke a read-only contract function without submitting a transaction.
 * Uses simulateTransaction under the hood.
 *
 * Returns the raw ScVal result.
 */
export async function invokeReadOnly(
  server: SorobanRpc.Server,
  networkConfig: NetworkConfig,
  sourcePublicKey: string,
  contractId: string,
  method: string,
  args: ScValArg[],
): Promise<xdr.ScVal> {
  const sourceAccount = await server.getAccount(sourcePublicKey);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: networkConfig.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Read simulation failed: ${simResult.error}`);
  }
  if (!SorobanRpc.Api.isSimulationSuccess(simResult)) {
    throw new Error('Simulation returned unexpected result type');
  }

  const retVal = simResult.result?.retval;
  if (!retVal) {
    throw new Error(`Contract call ${method} returned no value`);
  }
  return retVal;
}

/** Convert a hex string to a 32-byte Uint8Array, padded/truncated as needed. */
export function hexToBytes32(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(32);
  const len = Math.min(clean.length / 2, 32);
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { nativeToScVal, scValToNative, xdr };
