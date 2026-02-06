import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskType, RepeatMode, WeekDayKey } from '../task.entity';
import { FertilizerUnit } from '../task-fertilizer.entity';

class RepeatDto {
  @IsEnum(RepeatMode)
  mode: RepeatMode;

  // ✅ NOUVEAU: durée en semaines
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(260)
  durationWeeks?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  everyWeeks?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as unknown as WeekDayKey[], { each: true })
  days?: WeekDayKey[];
}

class FertLineDto {
  @IsString()
  @Length(1, 40)
  name: string;

  @IsNumber()
  @Min(0.01)
  qty: number;

  @IsEnum(FertilizerUnit)
  unit: FertilizerUnit;
}

export class CreateTaskDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  dueAt: string;

  @IsInt()
  aquariumId: number;

  @IsEnum(TaskType)
  type: TaskType;

  @IsOptional()
  @ValidateNested()
  @Type(() => RepeatDto)
  repeat?: RepeatDto | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FertLineDto)
  fertilization?: FertLineDto[] | null;
}
