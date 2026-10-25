import { IsBoolean } from 'class-validator';

export class SetGameTournamentDto {
  @IsBoolean()
  enabled!: boolean;
}
