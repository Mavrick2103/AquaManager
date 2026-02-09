import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export type WaterType = 'EAU_DOUCE' | 'EAU_DE_MER' | 'SAUMATRE';
export type PlantCategory =
  | 'TIGE' | 'ROSETTE' | 'RHIZOME' | 'MOUSSE' | 'GAZONNANTE' | 'BULBE' | 'FLOTTANTE' | 'EPIPHYTE';
export type PlantPlacement =
  | 'AVANT_PLAN' | 'MILIEU' | 'ARRIERE_PLAN' | 'SUR_SUPPORT' | 'SURFACE';
export type GrowthRate = 'LENTE' | 'MOYENNE' | 'RAPIDE';
export type Light = 'FAIBLE' | 'MOYEN' | 'FORT';
export type Co2 = 'AUCUN' | 'RECOMMANDE' | 'OBLIGATOIRE';
export type Difficulty = 'FACILE' | 'MOYEN' | 'DIFFICILE';
export type Propagation = 'BOUTURAGE' | 'STOLON' | 'RHIZOME' | 'DIVISION' | 'SPORES' | 'GRAINES' | 'AUCUNE';

export class CreatePlantCardDto {
  @IsString()
  @Length(2, 120)
  commonName: string;

  @IsIn(['EAU_DOUCE', 'EAU_DE_MER', 'SAUMATRE'])
  waterType: WaterType;

  @IsOptional() @IsString() @Length(2, 160)
  scientificName?: string;

  @IsOptional() @IsString() @Length(2, 120)
  family?: string;

  @IsOptional() @IsString() @Length(2, 120)
  origin?: string;

  @IsOptional()
  @IsIn(['TIGE', 'ROSETTE', 'RHIZOME', 'MOUSSE', 'GAZONNANTE', 'BULBE', 'FLOTTANTE', 'EPIPHYTE'])
  category?: PlantCategory;

  @IsOptional()
  @IsIn(['AVANT_PLAN', 'MILIEU', 'ARRIERE_PLAN', 'SUR_SUPPORT', 'SURFACE'])
  placement?: PlantPlacement;

  @IsOptional()
  @IsIn(['LENTE', 'MOYENNE', 'RAPIDE'])
  growthRate?: GrowthRate;

  @IsOptional() @IsNumber() @Min(0) @Max(999.9)
  maxHeightCm?: number;

  @IsOptional()
  @IsIn(['BOUTURAGE', 'STOLON', 'RHIZOME', 'DIVISION', 'SPORES', 'GRAINES', 'AUCUNE'])
  propagation?: Propagation;

  @IsOptional() @IsIn(['FAIBLE', 'MOYEN', 'FORT'])
  light?: Light;

  @IsOptional() @IsIn(['AUCUN', 'RECOMMANDE', 'OBLIGATOIRE'])
  co2?: Co2;

  @IsOptional() @IsIn(['FACILE', 'MOYEN', 'DIFFICILE'])
  difficulty?: Difficulty;

  @IsOptional() @IsNumber() tempMin?: number;
  @IsOptional() @IsNumber() tempMax?: number;

  @IsOptional() @IsNumber() phMin?: number;
  @IsOptional() @IsNumber() phMax?: number;

  @IsOptional() @IsNumber() ghMin?: number;
  @IsOptional() @IsNumber() ghMax?: number;

  @IsOptional() @IsNumber() khMin?: number;
  @IsOptional() @IsNumber() khMax?: number;

  @IsOptional() @IsBoolean() needsFe?: boolean;
  @IsOptional() @IsBoolean() needsNo3?: boolean;
  @IsOptional() @IsBoolean() needsPo4?: boolean;
  @IsOptional() @IsBoolean() needsK?: boolean;
  @IsOptional() @IsBoolean() substrateRequired?: boolean;

  @IsOptional() @IsString() trimming?: string;
  @IsOptional() @IsString() @Length(2, 120) compatibility?: string;
  @IsOptional() @IsString() notes?: string;

  @IsOptional() @IsString()
  imageUrl?: string;

  // admin peut décider, editor -> ignoré (forcé à false tant que PENDING)
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
