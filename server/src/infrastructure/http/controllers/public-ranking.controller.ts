import { Controller, Get } from '@nestjs/common';
import { GetPublicLandingRankingUseCase } from '../../../application/use-cases/get-public-landing-ranking.use-case.js';

/**
 * Controlador público (sin `JwtAuthGuard` a propósito): alimenta la landing
 * antes de iniciar sesión. Solo expone agregados enmascarados; ver el use-case.
 */
@Controller('public')
export class PublicRankingController {
  constructor(private readonly getPublicLandingRankingUseCase: GetPublicLandingRankingUseCase) {}

  @Get('ranking')
  getRanking() {
    return this.getPublicLandingRankingUseCase.execute();
  }
}
