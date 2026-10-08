import { Module } from '@nestjs/common';
import { VerificationApiController } from './verification-api.controller';
import { VerificationApiService } from './verification-api.service';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [ScoringModule],
  controllers: [VerificationApiController],
  providers: [VerificationApiService],
})
export class VerificationApiModule {}
