import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUrl, Length, Max, MaxLength, Min } from 'class-validator';
import type { MarketingPostFormat, MarketingPostStatus } from '../marketing-post.entity';

export class CreateMarketingPostDto {
  @IsString()
  @Length(3, 160)
  title: string;

  @IsString()
  @Length(10, 5000)
  caption: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  mediaUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  sourceUrl?: string;

  @IsIn(['POST', 'CAROUSEL', 'REEL', 'STORY'])
  format: MarketingPostFormat;

  @IsOptional()
  @IsIn(['DRAFT', 'PENDING_APPROVAL'])
  status?: MarketingPostStatus;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateMarketingPostDto {
  @IsOptional()
  @IsString()
  @Length(3, 160)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(10, 5000)
  caption?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  mediaUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  sourceUrl?: string;

  @IsOptional()
  @IsIn(['POST', 'CAROUSEL', 'REEL', 'STORY'])
  format?: MarketingPostFormat;

  @IsOptional()
  @IsIn(['DRAFT', 'PENDING_APPROVAL'])
  status?: MarketingPostStatus;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class RejectMarketingPostDto {
  @IsString()
  @Length(3, 500)
  reason: string;
}

export class GenerateMarketingPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  topic?: string;

  @IsOptional()
  @IsIn(['POST', 'CAROUSEL', 'REEL', 'STORY'])
  format?: MarketingPostFormat;
}

export class UpdateMarketingAgentSettingsDto {
  @IsBoolean()
  enabled: boolean;

  @IsIn(['WEEKLY', 'BIWEEKLY', 'MONTHLY'])
  cadence: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsInt()
  @Min(0)
  @Max(23)
  hour: number;

  @IsInt()
  @Min(0)
  @Max(59)
  minute: number;
}
