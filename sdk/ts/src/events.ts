/**
 * Typed event parsers for attestation-registry and issuer-registry events.
 *
 * The indexer (backend/src/indexer) subscribes to the same event shapes.
 * Keep the field names and topic strings here in sync with the Rust event
 * structs in contracts/attestation-registry/src/events.rs and
 * contracts/issuer-registry/src/events.rs.
 */

import { SorobanRpc, xdr, StrKey } from '@stellar/stellar-sdk';

// ── Event shape types ──────────────────────────────────────────────────────

export interface AttestationWrittenEvent {
  /** Issuer platform address (Stellar G-address). */
  issuer: string;
  /** Worker address (Stellar G-address). */
  subject: string;
  /** Nonce assigned to this attestation (key component for direct lookup). */
  nonce: bigint;
  /** Job type string (matches SDK JobType). */
  jobType: string;
  /** Rating on the 0–500 scale. */
  rating: number;
  /** Job weight. */
  weight: number;
  /** Ledger timestamp (Unix seconds). */
  timestamp: number;
}

export interface IssuerRegisteredEvent {
  /** Issuer platform address. */
  issuer: string;
  /** Stake amount in stroops. */
  stake: bigint;
}

// ── Parsers ────────────────────────────────────────────────────────────────

/**
 * Parse a raw Soroban RPC event into a typed AttestationWrittenEvent.
 *
 * Returns `null` if the event does not match the expected shape — this
 * handles mixed event streams gracefully.
 *
 * The indexer reuses this parsing logic; do not change field names without
 * updating backend/src/indexer as well.
 */
export function parseAttestationWrittenEvent(
  event: SorobanRpc.Api.RawEventResponse,
): AttestationWrittenEvent | null {
  try {
    const topics = event.topic.map((t) => xdr.ScVal.fromXDR(t, 'base64'));
    const data = xdr.ScVal.fromXDR(event.value, 'base64');

    // Topic[0]: symbol 'attestation_written'
    // Topic[1]: subject address
    if (topics.length < 2) return null;
    const topicSym = topics[0]?.sym()?.toString();
    if (topicSym !== 'attestation_written') return null;

    const subjectRaw = topics[1];
    const subject = scValToAddress(subjectRaw);
    if (!subject) return null;

    // Data is a map with keys: issuer, nonce, job_type, rating, weight, timestamp
    const map = data.map();
    if (!map) return null;

    const get = (key: string): xdr.ScVal | undefined =>
      map.find((e) => e.key().sym()?.toString() === key)?.val();

    const issuerVal = get('issuer');
    const nonceVal = get('nonce');
    const jobTypeVal = get('job_type');
    const ratingVal = get('rating');
    const weightVal = get('weight');
    const timestampVal = get('timestamp');

    if (!issuerVal || !nonceVal || !jobTypeVal || !ratingVal || !weightVal || !timestampVal) {
      return null;
    }

    return {
      issuer: scValToAddress(issuerVal) ?? '',
      subject,
      nonce: BigInt(nonceVal.u64().toString()),
      jobType: jobTypeVariantToString(jobTypeVal),
      rating: ratingVal.u32(),
      weight: weightVal.u32(),
      timestamp: Number(timestampVal.u64().toString()),
    };
  } catch {
    return null;
  }
}

/**
 * Parse a raw Soroban RPC event into a typed IssuerRegisteredEvent.
 * Returns `null` if the event does not match.
 */
export function parseIssuerRegisteredEvent(
  event: SorobanRpc.Api.RawEventResponse,
): IssuerRegisteredEvent | null {
  try {
    const topics = event.topic.map((t) => xdr.ScVal.fromXDR(t, 'base64'));
    const data = xdr.ScVal.fromXDR(event.value, 'base64');

    if (topics.length < 2) return null;
    const topicSym = topics[0]?.sym()?.toString();
    if (topicSym !== 'issuer_registered') return null;

    const issuerRaw = topics[1];
    const issuer = scValToAddress(issuerRaw);
    if (!issuer) return null;

    const map = data.map();
    if (!map) return null;

    const get = (key: string): xdr.ScVal | undefined =>
      map.find((e) => e.key().sym()?.toString() === key)?.val();

    const stakeVal = get('stake');
    if (!stakeVal) return null;

    // stake is i128
    const stakeI128 = stakeVal.i128();
    const stake = BigInt(stakeI128.hi().toString()) * BigInt(2 ** 64) + BigInt(stakeI128.lo().toString());

    return { issuer, stake };
  } catch {
    return null;
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────

/** Extract a G-address string from an Address ScVal. */
function scValToAddress(val: xdr.ScVal): string | null {
  try {
    const addr = val.address();
    if (addr.switch() === xdr.ScAddressType.scAddressTypeAccount()) {
      const pk = addr.accountId().ed25519();
      return StrKey.encodeEd25519PublicKey(pk);
    }
    return null;
  } catch {
    return null;
  }
}

/** Convert a Soroban enum ScVal (vec with a symbol) to a JobType string. */
function jobTypeVariantToString(val: xdr.ScVal): string {
  try {
    // Enum variant is represented as scvVec([scvSymbol('Variant')])
    const vec = val.vec();
    if (vec && vec.length > 0) {
      const sym = vec[0]?.sym()?.toString();
      if (sym) {
        const map: Record<string, string> = {
          Delivery: 'delivery',
          Rideshare: 'rideshare',
          FreelanceDev: 'freelance-dev',
          Other: 'other',
        };
        return map[sym] ?? sym.toLowerCase();
      }
    }
    return 'other';
  } catch {
    return 'other';
  }
}
