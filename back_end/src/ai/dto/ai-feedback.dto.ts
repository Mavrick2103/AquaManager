import { IsIn } from 'class-validator';

export class AiFeedbackDto {
  @IsIn(['HELPFUL', 'NOT_HELPFUL'])
  feedback!: 'HELPFUL' | 'NOT_HELPFUL';
}
