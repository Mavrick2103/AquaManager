import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Length } from 'class-validator';
import { TaskStatus, TaskType } from '../task.entity';

export class UpdateTaskDto {
  @IsOptional() @IsString() @Length(1, 200)
  title?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsDateString()
  dueAt?: string;

  @IsOptional() @IsInt()
  aquariumId?: number;

  @IsOptional() @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional() @IsEnum(TaskType)
  type?: TaskType;
}
