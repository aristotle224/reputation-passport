import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { VerificationApiService } from './verification-api.service';

@Controller('verification')
export class VerificationApiController {
  constructor(private readonly verificationApiService: VerificationApiService) {}

  /**
   * GET /api/v1/verification/profile/:address
   *
   * Returns a worker's attestations, composite score, and an on-chain proof
   * structure per README.md's Verification API description.
   */
  @Get('profile/:address')
  async getProfile(@Param('address') address: string) {
    try {
      return await this.verificationApiService.getProfile(address);
    } catch (err) {
      throw new HttpException((err as Error).message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/v1/verification/attestations/:address
   *
   * Returns all indexed attestations for a worker (including revoked).
   */
  @Get('attestations/:address')
  async getAttestations(@Param('address') address: string) {
    try {
      const attestations = await this.verificationApiService.getAttestations(address);
      return { attestations };
    } catch (err) {
      throw new HttpException((err as Error).message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/v1/verification/verify/:address/:issuer/:nonce
   *
   * Look up a specific attestation and return an on-chain verification note.
   */
  @Get('verify/:address/:issuer/:nonce')
  async verifyAttestation(
    @Param('address') address: string,
    @Param('issuer') issuer: string,
    @Param('nonce') nonce: string,
  ) {
    try {
      return await this.verificationApiService.verifyAttestation(
        address,
        issuer,
        parseInt(nonce, 10),
      );
    } catch (err) {
      throw new HttpException((err as Error).message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
