import { IsIn, IsObject, IsOptional } from 'class-validator';
import type { TargetProfileKey } from '../default-target-profiles';

export class UpdateAquariumTargetsDto {
  @IsOptional()
  @IsIn([
    'FRESH_COMMUNITY',
    'FRESH_PLANTED',
    'FRESH_SHRIMP',
    'FRESH_CICHLID',
    'SALT_REEF',
    'SALT_FISH_ONLY',
    'CUSTOM',
  ])
  profileKey?: TargetProfileKey;

  @IsOptional()
  @IsObject()
  targets?: Record<string, { min?: number | null; max?: number | null }>;
}
