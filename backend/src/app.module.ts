import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { IndexerModule } from './indexer/indexer.module';
import { ScoringModule } from './scoring/scoring.module';
import { IssuerApiModule } from './issuer-api/issuer-api.module';
import { VerificationApiModule } from './verification-api/verification-api.module';
import { SponsorshipModule } from './sponsorship/sponsorship.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    IndexerModule,
    ScoringModule,
    IssuerApiModule,
    VerificationApiModule,
    SponsorshipModule,
  ],
})
export class AppModule {}
