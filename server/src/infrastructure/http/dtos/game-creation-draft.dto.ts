import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { VALID_GAME_TYPES } from '../../../domain/value-objects/game-type.vo.js';

export class DraftIdParamDto {
  @IsUUID()
  id!: string;
}

export class SaveGameCreationDraftFormDto {
  @IsIn(VALID_GAME_TYPES)
  gameType!: string;

  /** Solo Memoria tiene modos; para los demás tipos va vacío. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  mode?: string;

  /** Estado completo del formulario; lo serializa cada formulario. */
  @IsObject()
  formState!: Record<string, unknown>;
}

export class SaveGameCreationDraftAiDto {
  @IsIn(VALID_GAME_TYPES)
  gameType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  mode?: string;

  /** JSON (texto) con el GameDraft devuelto por la IA; llega como multipart. */
  @IsString()
  result!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
