import { Controller, Post, Get, Body, Param, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { IssuerApiService } from './issuer-api.service';
import { AttestDto, AttestResponseDto, SubmitSignedDto } from './dto/attest.dto';

@Controller('issuer')
export class IssuerApiController {
  constructor(private readonly issuerApiService: IssuerApiService) {}

  /**
   * POST /api/v1/issuer/attest
   *
   * Build an attestation transaction for a registered issuer.
   * Default (trust-minimized) path returns unsigned XDR for the platform to
   * sign — per README.md "the more trust-minimized default".
   * Pass custodialSign=true to have the backend sign and submit directly.
   */
  @Post('attest')
  async attest(
    @Body() dto: AttestDto,
    @Headers('x-issuer-key') apiKey: string,
  ): Promise<AttestResponseDto> {
    try {
      return await this.issuerApiService.buildAttest(dto, apiKey);
    } catch (err) {
      throw new HttpException((err as Error).message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /api/v1/issuer/attest/submit
   *
   * Submit a pre-signed attestation transaction XDR.
   */
  @Post('attest/submit')
  async submitSigned(@Body() dto: SubmitSignedDto): Promise<{ txHash: string }> {
    try {
      return await this.issuerApiService.submitSigned(dto.signedXdr);
    } catch (err) {
      throw new HttpException((err as Error).message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /api/v1/issuer/status/:address
   *
   * Placeholder — full issuer status lookup would cross-reference the
   * issuer-registry contract via the indexer's issuers table.
   */
  @Get('status/:address')
  async getIssuerStatus(@Param('address') address: string) {
    return { address, message: 'Check indexer /api/v1/indexer/status for indexed issuer data' };
  }
}
