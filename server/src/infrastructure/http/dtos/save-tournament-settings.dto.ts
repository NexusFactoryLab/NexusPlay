import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsString, Max, Min, ValidateNested } from 'class-validator';
import {
  TOURNAMENT_MAX_GAMES,
  TOURNAMENT_MAX_PARTICIPANTS,
  TOURNAMENT_MAX_ROUNDS,
  TOURNAMENT_MIN_PARTICIPANTS,
} from '../../../domain/ports/tournament-settings.repository.port.js';
import type { TournamentLevel } from '../../../domain/ports/tournament-store.port.js';

export class TournamentSettingsGameDto {
  @IsString()
  gameId!: string;

  @IsIn(['EASY', 'MEDIUM', 'HARD'])
  level!: TournamentLevel;
}

export class SaveTournamentSettingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(TOURNAMENT_MAX_GAMES)
  @ValidateNested({ each: true })
  @Type(() => TournamentSettingsGameDto)
  games!: TournamentSettingsGameDto[];

  @IsInt()
  @Min(TOURNAMENT_MIN_PARTICIPANTS)
  @Max(TOURNAMENT_MAX_PARTICIPANTS)
  maxParticipants!: number;

  @IsInt()
  @Min(1)
  @Max(TOURNAMENT_MAX_ROUNDS)
  totalRounds!: number;
}
