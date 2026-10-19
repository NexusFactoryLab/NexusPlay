import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';
import { MAX_AVATAR_IDS } from '../../../application/use-cases/get-users-avatars.use-case.js';

/** GET /users/avatars?ids=a,b,c (issue #77): ids separados por coma. */
export class GetUsersAvatarsQueryDto {
  @Transform(({ value }) =>
    (Array.isArray(value) ? value.join(',') : String(value ?? ''))
      .split(',')
      .map((id: string) => id.trim())
      .filter(Boolean),
  )
  @IsArray()
  @ArrayMaxSize(MAX_AVATAR_IDS)
  @IsString({ each: true })
  ids!: string[];
}
