import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DOCUMENT_TYPES } from '../../../application/use-cases/sign-tournament-confidentiality.use-case.js';

export class GuardianDto {
  @IsString()
  @Length(3, 120)
  fullName!: string;

  @IsIn(DOCUMENT_TYPES)
  documentType!: string;

  @IsString()
  @Length(3, 30)
  documentNumber!: string;

  @IsString()
  @Length(2, 40)
  relationship!: string;

  @IsBoolean()
  accepted!: boolean;
}

export class SignTournamentConfidentialityDto {
  @IsString()
  @Length(3, 120)
  fullName!: string;

  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  documentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  documentNumber?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string;

  /** AAAA-MM-DD. */
  @IsDateString()
  birthDate!: string;

  @Equals(true, { message: 'Debes aceptar el acuerdo de confidencialidad.' })
  acceptedConfidentiality!: boolean;

  @Equals(true, { message: 'Debes autorizar el tratamiento de tus datos.' })
  acceptedDataProcessing!: boolean;

  @IsString()
  @Length(3, 120)
  signatureName!: string;

  @IsString()
  @MaxLength(40)
  textVersion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  textHash?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuardianDto)
  guardian?: GuardianDto;
}
