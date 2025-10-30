import { IsEnum, IsInt, IsString, Min, Max, IsDateString } from 'class-validator';

export class CreateAquariumDto {
  @IsString()
  name: string;

  @IsInt() @Min(10) @Max(500)
  lengthCm: number;

  @IsInt() @Min(10) @Max(200)
  widthCm: number;

  @IsInt() @Min(10) @Max(200)
  heightCm: number;

  @IsEnum(['EAU_DOUCE', 'EAU_DE_MER'])
  waterType: 'EAU_DOUCE' | 'EAU_DE_MER';

  @IsDateString()
  startDate: string;
}
