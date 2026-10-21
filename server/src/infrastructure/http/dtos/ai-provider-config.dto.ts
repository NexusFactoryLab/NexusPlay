import { ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Campos comunes de alta y edición. La validación semántica (URL, tipo) vive en el caso de uso. */
class AiProviderConfigBaseDto {
  @IsString()
  @MaxLength(60)
  name!: string;

  @IsString()
  @MaxLength(40)
  kind!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  baseUrl?: string | null;

  @IsString()
  @MaxLength(120)
  textModel!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  visionModel?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  maxRpm?: number | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class CreateAiProviderConfigDto extends AiProviderConfigBaseDto {
  @IsString()
  @MaxLength(500)
  apiKey!: string;
}

export class UpdateAiProviderConfigDto extends AiProviderConfigBaseDto {
  /** Solo para rotar la key; omitida = se conserva. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;
}

export class ListAiProviderModelsDto {
  @IsString()
  @MaxLength(40)
  kind!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  baseUrl?: string | null;

  /** Solo si el admin la acaba de pegar; si no, se usa la guardada de `configId`. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  configId?: string;
}

export class ReorderAiProviderConfigsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
