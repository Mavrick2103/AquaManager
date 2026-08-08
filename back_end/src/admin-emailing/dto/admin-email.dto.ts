import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';

export enum EmailAudience {
  ALL = 'ALL',
  INACTIVE = 'INACTIVE',
  NEVER_CONNECTED = 'NEVER_CONNECTED',
  SINGLE_USER = 'SINGLE_USER',
}

export enum ConsentFilter {
  ANY = 'ANY',
  OPTED_IN = 'OPTED_IN',
  OPTED_OUT = 'OPTED_OUT',
}

export class AdminEmailAudienceDto {
  @IsEnum(EmailAudience)
  audience: EmailAudience = EmailAudience.ALL;

  @IsEnum(ConsentFilter)
  consent: ConsentFilter = ConsentFilter.ANY;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(3650)
  inactiveDays?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  userId?: number;
}

export class SendAdminEmailDto extends AdminEmailAudienceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  subject: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  message: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  actionUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  actionLabel?: string;
}
