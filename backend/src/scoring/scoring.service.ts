import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.module';

// TODO: implement scoring engine — see commit 7
@Injectable()
export class ScoringService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}
}
