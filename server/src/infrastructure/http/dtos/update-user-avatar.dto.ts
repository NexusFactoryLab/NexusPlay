import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Cuerpo de PUT /users/me/avatar (issues #77 y #136, estilo Voxel Art). Aquí
 * solo se filtra el tipo de cada campo; qué variantes y colores son válidos lo
 * decide `AvatarConfig` en el dominio. El gorro, el pantalón y el calzado son
 * opcionales para que un cliente de antes de #136 pueda seguir guardando.
 */
export class UpdateUserAvatarDto {
  @IsOptional() @IsString() @MaxLength(30) top?: string | null;
  @IsOptional() @IsString() @MaxLength(30) hat?: string | null;
  @IsString() @MaxLength(30) outfit!: string;
  @IsOptional() @IsString() @MaxLength(30) pants?: string;
  @IsOptional() @IsString() @MaxLength(30) shoes?: string;
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
