import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AVATAR_SKINS, type AvatarSkin } from '../../../domain/value-objects/avatar-config.vo.js';

/**
 * Cuerpo de PUT /users/me/avatar (issue #77). Aquí solo se filtra el tipo de
 * cada campo; que cada pieza corresponda a su ranura y que un vestido no se
 * combine con otra prenda lo decide `AvatarConfig` en el dominio.
 */
export class UpdateUserAvatarDto {
  @IsIn(AVATAR_SKINS)
  skin!: AvatarSkin;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  hair?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  hat?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  top?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  outer?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  bottom?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  dress?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  shoes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  portrait?: string | null;
}
