import { IsISO8601, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateWaterMeasurementDto {
  @IsISO8601() measuredAt!: string;

  // communs
  @IsOptional() @IsNumber() @Min(0) @Max(14) ph?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(40) temp?: number;

  // douce
  @IsOptional() @IsNumber() @Min(0) @Max(30) kh?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(40) gh?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(5)  no2?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) no3?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(3) fe?: number;   
  @IsOptional() @IsNumber() @Min(0) @Max(50) k?: number;     
  @IsOptional() @IsNumber() @Min(0) @Max(10) sio2?: number;  
  @IsOptional() @IsNumber() @Min(0) @Max(5) nh3?: number; 

  // mer
  @IsOptional() @IsNumber() @Min(0) @Max(20) dkh?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(45) salinity?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(600) ca?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1800) mg?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(5) po4?: number;

  @IsOptional() @IsString() comment?: string;
}
