import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class AnalyzePhotoDto {
  @IsOptional()
  @IsString()
  @IsIn(['ALGAE', 'FISH_DISEASE', 'PLANT_PROBLEM', 'WATER_TROUBLE', 'OTHER'])
  problemType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  question?: string;
}