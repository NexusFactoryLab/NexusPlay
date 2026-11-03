import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  ABSOLUTE_MAX_SCORE,
  MAX_COUNT,
  MAX_PLAY_TIME_MS,
} from '../../../domain/services/play-result-rules.js';

export class RecordGamePlayResultDto {
  @IsString()
  gameId!: string;

  /** Solo informativo: el servidor guarda el título real del juego. */
  @IsOptional()
  @IsString()
  gameTitle?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  subjectName?: string;

  @IsInt()
  @Min(0)
  @Max(ABSOLUTE_MAX_SCORE)
  score!: number;

  @IsInt()
  @Min(0)
  @Max(MAX_COUNT)
  correctCount!: number;

  @IsInt()
  @Min(0)
  @Max(MAX_COUNT)
  incorrectCount!: number;

  @IsInt()
  @Min(0)
  @Max(MAX_PLAY_TIME_MS)
  timePlayedMs!: number;
}
