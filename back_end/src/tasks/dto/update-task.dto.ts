import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Length } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional() @IsString() @Length(1, 200)
  title?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsDateString()
  dueAt?: string;

  @IsOptional() @IsInt()
  aquariumId?: number;

  @IsOptional() @IsEnum(['PENDING','DONE'])
  status?: 'PENDING' | 'DONE';

  @IsOptional() @IsEnum(['WATER_CHANGE','FERTILIZATION','TRIM','WATER_TEST','OTHER'])
  type?: 'WATER_CHANGE' | 'FERTILIZATION' | 'TRIM' | 'WATER_TEST' | 'OTHER';
}
