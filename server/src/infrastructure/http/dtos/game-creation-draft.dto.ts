import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { VALID_GAME_TYPES } from '../../../domain/value-objects/game-type.vo.js';

/** Clave de un borrador: tipo de juego y modo opcional (solo Memoria). */
export class GameCreationDraftKeyDto {
  @IsIn(VALID_GAME_TYPES)
  gameType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  mode?: string;
}

export class SaveGameCreationDraftFormDto extends GameCreationDraftKeyDto {
  @IsObject()
  formState!: Record<string, unknown>;
}

export class SaveGameCreationDraftAiDto extends GameCreationDraftKeyDto {
  /** JSON (texto) con el GameDraft devuelto por la IA; llega como multipart. */
  @IsString()
  result!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
