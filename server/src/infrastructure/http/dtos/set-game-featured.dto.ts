import { IsBoolean } from 'class-validator';

export class SetGameFeaturedDto {
  @IsBoolean()
  featured!: boolean;
}
