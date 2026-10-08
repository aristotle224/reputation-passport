import { Controller, Get } from '@nestjs/common';
import { IndexerService } from './indexer.service';

@Controller('indexer')
export class IndexerController {
  constructor(private readonly indexerService: IndexerService) {}

  /** GET /api/v1/indexer/status — returns the current indexer state. */
  @Get('status')
  async getStatus() {
    return this.indexerService.getStatus();
  }
}
