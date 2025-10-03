import { IsDateString, IsInt, IsOptional, IsString, Length, IsEnum } from 'class-validator';

export class CreateTaskDto {
  @IsString() @Length(1, 200)
  title: string;

  @IsOptional() @IsString()
  description?: string;

  @IsDateString()
  dueAt: string;

  @IsInt()
  aquariumId: number;

  @IsEnum(['WATER_CHANGE','FERTILIZATION','TRIM','WATER_TEST','OTHER'])
  type: 'WATER_CHANGE' | 'FERTILIZATION' | 'TRIM' | 'WATER_TEST' | 'OTHER';
}
