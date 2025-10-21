import { IsBoolean, IsEnum, IsNumber, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsEnum(['system','light','dark'])
  theme?: 'system'|'light'|'dark';

  @IsOptional() @IsEnum(['cards','table'])
  defaultView?: 'cards'|'table';

  @IsOptional() @IsEnum(['C','F'])
  temperatureUnit?: 'C'|'F';

  @IsOptional() @IsEnum(['L','GAL'])
  volumeUnit?: 'L'|'GAL';

  @IsOptional() @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional() @IsBoolean()
  pushNotifications?: boolean;

  @IsOptional() @IsBoolean()
  alertsEnabled?: boolean;

  @IsOptional() @IsNumber()
  phMin?: number;

  @IsOptional() @IsNumber()
  phMax?: number;

  @IsOptional() @IsNumber()
  tempMin?: number;

  @IsOptional() @IsNumber()
  tempMax?: number;
}
