import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.module';
import { ScoringService } from '../scoring/scoring.service';

// TODO: implement verification API service — see commit 8
@Injectable()
export class VerificationApiService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly scoringService: ScoringService,
  ) {}
}
