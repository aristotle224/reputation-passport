import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { SponsorshipService } from './sponsorship.service';

@Controller('sponsorship')
export class SponsorshipController {
  constructor(private readonly sponsorshipService: SponsorshipService) {}

  /**
   * POST /api/v1/sponsorship/fee-bump
   *
   * Wraps a signed inner transaction XDR in a fee-bump envelope.
   * Used by the SDK's SponsorshipClient.requestFeeBump().
   */
  @Post('fee-bump')
  async wrapFeeBump(@Body() body: { innerTxXdr: string }): Promise<{ feeBumpXdr: string }> {
    try {
      const feeBumpXdr = await this.sponsorshipService.wrapFeeBump(body.innerTxXdr);
      return { feeBumpXdr };
    } catch (err) {
      throw new HttpException((err as Error).message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /api/v1/sponsorship/fee-bump/submit
   *
   * Wraps and submits a fee-bump transaction end-to-end.
   * Used by the SDK's SponsorshipClient.submitSponsored().
   */
  @Post('fee-bump/submit')
  async submitFeeBump(@Body() body: { innerTxXdr: string }): Promise<{ txHash: string }> {
    try {
      const txHash = await this.sponsorshipService.submitFeeBump(body.innerTxXdr);
      return { txHash };
    } catch (err) {
      throw new HttpException((err as Error).message, HttpStatus.BAD_REQUEST);
    }
  }
}
