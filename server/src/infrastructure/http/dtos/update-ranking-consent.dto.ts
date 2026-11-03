import { IsBoolean } from 'class-validator';

/** Cuerpo de PUT /users/me/ranking-consent: true = quiero aparecer, false = no. */
export class UpdateRankingConsentDto {
  @IsBoolean() accepted!: boolean;
}
