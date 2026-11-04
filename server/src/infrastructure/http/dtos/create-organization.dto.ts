import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { INSTITUTION_TYPES } from '../../../domain/value-objects/institution-type.vo.js';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(3)
  name!: string;

  /**
   * Dominio de correo a reclamar (ej. "colegio.edu.co"). Opcional: una
   * organización sin dominio simplemente no hace auto-join. El formato lo
   * valida `EmailDomain` en el dominio, no este DTO de transporte.
   */
  @IsOptional()
  @IsString()
  domain?: string | null;

  /** Universidad, colegio u otra. Opcional: sin él la organización queda sin clasificar. */
  @IsOptional()
  @IsIn(INSTITUTION_TYPES)
  institutionType?: string | null;
}
