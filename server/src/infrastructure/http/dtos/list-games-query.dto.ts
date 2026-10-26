import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { VALID_GAME_TYPES } from '../../../domain/value-objects/game-type.vo.js';

export class ListGamesQueryDto {
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'FLAGGED', 'REMOVED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'FLAGGED' | 'REMOVED';

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  onlyMine?: boolean;

  /** Sección "Comunidad": todos los juegos publicados, con el nombre del creador. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  community?: boolean;

  /** Inicio: solo los juegos destacados por un ADMIN. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  /** Juegos institucionales de una organización concreta (issue #226, Juegos de la institución). */
  @IsOptional()
  @IsString()
  organizationId?: string;

  /** Filtro por tipo de juego exacto, usado por la vista de catálogo de tipos (issue #156). */
  @IsOptional()
  @IsIn(VALID_GAME_TYPES)
  gameType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
