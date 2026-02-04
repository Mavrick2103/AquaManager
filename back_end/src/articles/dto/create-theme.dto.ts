import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateThemeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;
}
