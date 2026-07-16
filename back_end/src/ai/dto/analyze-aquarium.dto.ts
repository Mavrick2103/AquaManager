import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AnalyzeAquariumDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  question?: string;
}