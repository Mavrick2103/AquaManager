import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsIn(['metric','imperial']) unit?: 'metric'|'imperial';
  @IsOptional() @IsIn(['light','dark','system']) theme?: 'light'|'dark'|'system';
  @IsOptional() @IsIn(['fr','en']) language?: 'fr'|'en';
  @IsOptional() @IsBoolean() notifications?: boolean;
}
