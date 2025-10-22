import { IsDateString, IsInt, IsOptional, IsString, Length, IsEnum } from 'class-validator';
import { TaskType } from '../task.entity';

export class CreateTaskDto {
  @IsString() @Length(1, 200)
  title: string;

  @IsOptional() @IsString()
  description?: string;

  @IsDateString()
  dueAt: string;

  @IsInt()
  aquariumId: number;

  @IsEnum(TaskType)
  type: TaskType;
}
