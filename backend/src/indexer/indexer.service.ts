import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Inject,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Pool } from 'pg';
import { SorobanRpc, xdr, StrKey } from '@stellar/stellar-sdk';
import { DATABASE_POOL } from '../database/database.module';

/**
 * AttestationWrittenEvent — mirrors the on-chain event emitted by
 * attestation-registry/src/events.rs. Field names must stay in sync with
 * the SDK event parsers (sdk/ts/src/events.ts).
 */
export interface AttestationWrittenEvent {
  issuer: string;
  subject: string;
  nonce: bigint;
  jobType: string;
  rating: number;
  weight: number;
  timestamp: number;
}

export interface IssuerRegisteredEvent {
  issuer: string;
  stake: bigint;
}

@Injectable()
export class IndexerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IndexerService.name);
  private readonly rpcUrl =
    process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';
  private readonly attestationRegistryId =
    process.env.ATTESTATION_REGISTRY_ID ?? '';
  private readonly issuerRegistryId = process.env.ISSUER_REGISTRY_ID ?? '';
  private server: SorobanRpc.Server;
  private lastIndexedLedger = 0;
  private polling = false;

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {
    this.server = new SorobanRpc.Server(this.rpcUrl, { allowHttp: true });
  }

  async onApplicationBootstrap() {
    await this.loadLastIndexedLedger();
    this.logger.log(
      `Indexer starting from ledger ${this.lastIndexedLedger}`,
    );
  }

  /**
   * Poll Soroban RPC for new events every 5 seconds.
   * Uses @nestjs/schedule @Interval; called automatically after bootstrap.
   * Never re-scans full contract state — subscribes to events only.
   */
  @Interval(5000)
  async poll(): Promise<void> {
    if (this.polling) return; // prevent overlap
    if (!this.attestationRegistryId && !this.issuerRegistryId) return;
    this.polling = true;
    try {
      await this.fetchAndPersistEvents();
    } catch (err) {
      this.logger.error('Indexer poll error', err);
    } finally {
      this.polling = false;
    }
  }

  private async fetchAndPersistEvents(): Promise<void> {
    const contractIds: string[] = [];
    if (this.attestationRegistryId) contractIds.push(this.attestationRegistryId);
    if (this.issuerRegistryId) contractIds.push(this.issuerRegistryId);
    if (contractIds.length === 0) return;

    const filters = contractIds.map((id) => ({ contractId: id, type: 'contract' as const }));

    const result = await this.server.getEvents({
      startLedger: this.lastIndexedLedger || undefined,
      filters,
      limit: 100,
    });

    if (!result.events || result.events.length === 0) return;

    let maxLedger = this.lastIndexedLedger;

    for (const event of result.events) {
      const ledger = event.ledger;
      if (ledger > maxLedger) maxLedger = ledger;

      // Parse and persist based on topic
      const parsed = this.parseEvent(event as unknown as SorobanRpc.Api.RawEventResponse);
      if (parsed?.type === 'attestation_written') {
        await this.persistAttestation(parsed.data as AttestationWrittenEvent, ledger);
      } else if (parsed?.type === 'issuer_registered') {
        await this.persistIssuer(parsed.data as IssuerRegisteredEvent, ledger);
      }
    }

    if (maxLedger > this.lastIndexedLedger) {
      await this.updateLastIndexedLedger(maxLedger + 1);
    }
  }

  private parseEvent(
    event: SorobanRpc.Api.RawEventResponse,
  ): { type: string; data: unknown } | null {
    try {
      if (!event.topic || event.topic.length === 0) return null;
      const topics = event.topic.map((t) => xdr.ScVal.fromXDR(t, 'base64'));
      const firstTopic = topics[0]?.sym()?.toString();

      if (firstTopic === 'attestation_written') {
        return { type: 'attestation_written', data: this.parseAttestationWritten(topics, event) };
      }
      if (firstTopic === 'issuer_registered') {
        return { type: 'issuer_registered', data: this.parseIssuerRegistered(topics, event) };
      }
      return null;
    } catch {
      return null;
    }
  }

  private parseAttestationWritten(
    topics: xdr.ScVal[],
    event: SorobanRpc.Api.RawEventResponse,
  ): AttestationWrittenEvent | null {
    try {
      const subject = this.scValToAddress(topics[1]);
      if (!subject) return null;

      const data = xdr.ScVal.fromXDR(event.value, 'base64');
      const map = data.map();
      if (!map) return null;

      const get = (key: string) =>
        map.find((e) => e.key().sym()?.toString() === key)?.val();

      return {
        subject,
        issuer: this.scValToAddress(get('issuer')) ?? '',
        nonce: BigInt(get('nonce')?.u64().toString() ?? '0'),
        jobType: this.scValEnumToString(get('job_type')),
        rating: get('rating')?.u32() ?? 0,
        weight: get('weight')?.u32() ?? 0,
        timestamp: Number(get('timestamp')?.u64().toString() ?? '0'),
      };
    } catch {
      return null;
    }
  }

  private parseIssuerRegistered(
    topics: xdr.ScVal[],
    event: SorobanRpc.Api.RawEventResponse,
  ): IssuerRegisteredEvent | null {
    try {
      const issuer = this.scValToAddress(topics[1]);
      if (!issuer) return null;

      const data = xdr.ScVal.fromXDR(event.value, 'base64');
      const map = data.map();
      if (!map) return null;

      const get = (key: string) =>
        map.find((e) => e.key().sym()?.toString() === key)?.val();

      const stakeVal = get('stake');
      const stakeI128 = stakeVal?.i128();
      const stake = stakeI128
        ? BigInt(stakeI128.hi().toString()) * BigInt(2 ** 64) +
          BigInt(stakeI128.lo().toString())
        : 0n;

      return { issuer, stake };
    } catch {
      return null;
    }
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  async persistAttestation(
    event: AttestationWrittenEvent,
    ledger: number,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO attestations
         (issuer_address, subject_address, nonce, job_type, rating, weight,
          timestamp, ledger_sequence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (issuer_address, subject_address, nonce) DO NOTHING`,
      [
        event.issuer,
        event.subject,
        event.nonce.toString(),
        event.jobType,
        event.rating,
        event.weight,
        event.timestamp.toString(),
        ledger,
      ],
    );
  }

  async persistIssuer(event: IssuerRegisteredEvent, ledger: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO issuers (address, stake, status, ledger_sequence)
       VALUES ($1,$2,'active',$3)
       ON CONFLICT (address) DO NOTHING`,
      [event.issuer, event.stake.toString(), ledger],
    );
  }

  // ── Ledger state ─────────────────────────────────────────────────────────

  private async loadLastIndexedLedger(): Promise<void> {
    try {
      const { rows } = await this.pool.query(
        'SELECT last_indexed_ledger FROM indexer_state WHERE id = 1',
      );
      if (rows.length > 0) {
        this.lastIndexedLedger = rows[0].last_indexed_ledger ?? 0;
      }
    } catch {
      // Table may not exist yet (before first migration)
      this.lastIndexedLedger = 0;
    }
  }

  private async updateLastIndexedLedger(ledger: number): Promise<void> {
    this.lastIndexedLedger = ledger;
    try {
      await this.pool.query(
        `UPDATE indexer_state SET last_indexed_ledger = $1, updated_at = NOW() WHERE id = 1`,
        [ledger],
      );
    } catch {
      // Ignore if table isn't ready
    }
  }

  // ── Status ────────────────────────────────────────────────────────────────

  async getStatus(): Promise<{
    lastIndexedLedger: number;
    attestationCount: number;
    issuerCount: number;
  }> {
    try {
      const [att, iss] = await Promise.all([
        this.pool.query('SELECT COUNT(*)::int AS count FROM attestations'),
        this.pool.query('SELECT COUNT(*)::int AS count FROM issuers'),
      ]);
      return {
        lastIndexedLedger: this.lastIndexedLedger,
        attestationCount: att.rows[0]?.count ?? 0,
        issuerCount: iss.rows[0]?.count ?? 0,
      };
    } catch {
      return { lastIndexedLedger: this.lastIndexedLedger, attestationCount: 0, issuerCount: 0 };
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private scValToAddress(val: xdr.ScVal | undefined): string | null {
    if (!val) return null;
    try {
      const addr = val.address();
      if (addr.switch() === xdr.ScAddressType.scAddressTypeAccount()) {
        return StrKey.encodeEd25519PublicKey(addr.accountId().ed25519());
      }
      return null;
    } catch {
      return null;
    }
  }

  private scValEnumToString(val: xdr.ScVal | undefined): string {
    if (!val) return 'other';
    try {
      const vec = val.vec();
      if (vec && vec.length > 0) {
        const sym = vec[0]?.sym()?.toString() ?? '';
        const map: Record<string, string> = {
          Delivery: 'delivery',
          Rideshare: 'rideshare',
          FreelanceDev: 'freelance-dev',
          Other: 'other',
        };
        return map[sym] ?? sym.toLowerCase();
      }
    } catch {
      // fall through
    }
    return 'other';
  }
}
