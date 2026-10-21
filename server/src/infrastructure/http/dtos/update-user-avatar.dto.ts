import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Cuerpo de PUT /users/me/avatar (issue #77, estilo Voxel Art). Aquí solo se
 * filtra el tipo de cada campo; qué variantes y colores son válidos lo decide
 * `AvatarConfig` en el dominio.
 */
export class UpdateUserAvatarDto {
  @IsOptional() @IsString() @MaxLength(30) top?: string | null;
  @IsString() @MaxLength(30) outfit!: string;
  @IsString() @MaxLength(30) eyes!: string;
  @IsOptional() @IsString() @MaxLength(30) eyebrows?: string | null;
  @IsString() @MaxLength(30) mouth!: string;
  @IsString() @MaxLength(30) nose!: string;
  @IsOptional() @IsString() @MaxLength(30) cheeks?: string | null;
  @IsOptional() @IsString() @MaxLength(30) glasses?: string | null;
  @IsOptional() @IsString() @MaxLength(30) beard?: string | null;
  @IsString() @MaxLength(6) hairColor!: string;
  @IsString() @MaxLength(6) hatColor!: string;
  @IsString() @MaxLength(6) skinColor!: string;
  @IsString() @MaxLength(6) shirtColor!: string;
  @IsString() @MaxLength(6) jacketColor!: string;
  @IsString() @MaxLength(6) pantsColor!: string;
  @IsString() @MaxLength(6) shoesColor!: string;
}
