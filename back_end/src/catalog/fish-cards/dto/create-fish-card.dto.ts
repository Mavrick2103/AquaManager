import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER' | 'SAUMATRE';
type Temperament = 'PACIFIQUE' | 'SEMI_AGRESSIF' | 'AGRESSIF';
type Activity = 'DIURNE' | 'NOCTURNE' | 'CREPUSCULAIRE';
type Difficulty = 'FACILE' | 'MOYEN' | 'DIFFICILE';

const EmptyToUndef = () => Transform(({ value }) => (value === '' ? undefined : value));

export class CreateFishCardDto {
  @IsString()
  @Length(2, 120)
  commonName: string;

  @IsOptional()
  @EmptyToUndef()
  @IsString()
  @Length(2, 160)
  scientificName?: string;

  @IsOptional()
  @EmptyToUndef()
  @IsString()
  @Length(2, 120)
  family?: string;

  @IsOptional()
  @EmptyToUndef()
  @IsString()
  @Length(2, 120)
  origin?: string;

  // ✅ OBLIGATOIRE
  @IsIn(['EAU_DOUCE', 'EAU_DE_MER', 'SAUMATRE'])
  waterType: WaterType;

  @IsOptional() @Type(() => Number) @IsNumber() tempMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() tempMax?: number;

  @IsOptional() @Type(() => Number) @IsNumber() phMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() phMax?: number;

  @IsOptional() @Type(() => Number) @IsNumber() ghMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() ghMax?: number;

  @IsOptional() @Type(() => Number) @IsNumber() khMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() khMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  minVolumeL?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  minGroupSize?: number;

  @IsOptional() @Type(() => Number) @IsNumber() maxSizeCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(100)
  lifespanYears?: number;

  @IsOptional()
  @EmptyToUndef()
  @IsIn(['DIURNE', 'NOCTURNE', 'CREPUSCULAIRE'])
  activity?: Activity;

  @IsOptional()
  @EmptyToUndef()
  @IsIn(['PACIFIQUE', 'SEMI_AGRESSIF', 'AGRESSIF'])
  temperament?: Temperament;

  @IsOptional()
  @EmptyToUndef()
  @IsIn(['FACILE', 'MOYEN', 'DIFFICILE'])
  difficulty?: Difficulty;

  @IsOptional() @EmptyToUndef() @IsString() @Length(2, 120) zone?: string;
  @IsOptional() @EmptyToUndef() @IsString() @Length(2, 120) diet?: string;
  @IsOptional() @EmptyToUndef() @IsString() @Length(2, 120) compatibility?: string;

  @IsOptional() @EmptyToUndef() @IsString() behavior?: string;
  @IsOptional() @EmptyToUndef() @IsString() breeding?: string;
  @IsOptional() @EmptyToUndef() @IsString() breedingTips?: string;
  @IsOptional() @EmptyToUndef() @IsString() notes?: string;

  @IsOptional()
  @EmptyToUndef()
  @IsString()
  @MaxLength(255)
  @Matches(/^(\/uploads\/fish\/.+\.(jpg|jpeg|png|webp)|https?:\/\/.+)$/i, {
    message: "imageUrl doit être '/uploads/fish/...' ou une URL http(s)",
  })
  imageUrl?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
