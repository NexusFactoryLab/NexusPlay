import { IsDateString, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ACADEMIC_PROGRAM_MAX_LENGTH } from '../../../domain/value-objects/academic-program.vo.js';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  middleName?: string | null;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string | null;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  /**
   * Facultad, carrera o grado (opcional). `null` o texto vacío lo quita. El
   * límite aquí es una primera barrera; la limpieza (espacios, caracteres
   * invisibles o no permitidos) la hace `normalizeAcademicProgram` en el dominio.
   */
  @IsOptional()
  @IsString()
  @MaxLength(ACADEMIC_PROGRAM_MAX_LENGTH)
  academicProgram?: string | null;
}
