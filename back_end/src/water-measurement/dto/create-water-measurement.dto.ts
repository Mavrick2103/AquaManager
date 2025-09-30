import { IsDateString, IsNumber, IsOptional } from 'class-validator';

export class CreateWaterMeasurementDto {
  @IsDateString()
  takenAt!: string; // ISO string

  @IsOptional() @IsNumber() ph?: number;
  @IsOptional() @IsNumber() kh?: number;
  @IsOptional() @IsNumber() gh?: number;
  @IsOptional() @IsNumber() co2?: number;
  @IsOptional() @IsNumber() k?: number;
  @IsOptional() @IsNumber() no2?: number;
  @IsOptional() @IsNumber() no3?: number;
  @IsOptional() @IsNumber() amn?: number;
  @IsOptional() @IsNumber() fe?: number;
  @IsOptional() @IsNumber() temp?: number;
  @IsOptional() @IsNumber() po4?: number;
}
