import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional() @IsString() @MaxLength(60) fullName?: string;
  @IsOptional() @IsEmail() email?: string;
}
