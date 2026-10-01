import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  IsIn,
} from 'class-validator';
export class SubmitSatisfactionDto {
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) premiumRating?: number;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}
export class ReviewSatisfactionDto {
  @IsIn(['NEW', 'READ', 'DONE']) status: string;
}
