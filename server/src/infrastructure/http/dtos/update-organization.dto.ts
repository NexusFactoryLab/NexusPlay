import { IsIn, IsOptional } from 'class-validator';
import { INSTITUTION_TYPES } from '../../../domain/value-objects/institution-type.vo.js';

export class UpdateOrganizationDto {
  /**
   * Universidad, colegio u otra. `null` la deja sin clasificar; ausente no la
   * cambia. La validación definitiva la repite `parseInstitutionType` en el dominio.
   */
  @IsOptional()
  @IsIn(INSTITUTION_TYPES)
  institutionType?: string | null;
}
