import { Module } from '@nestjs/common';
import { IssuerApiController } from './issuer-api.controller';
import { IssuerApiService } from './issuer-api.service';

@Module({
  controllers: [IssuerApiController],
  providers: [IssuerApiService],
})
export class IssuerApiModule {}
