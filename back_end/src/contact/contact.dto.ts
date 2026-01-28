import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ContactDto {
  @IsIn(['BUG', 'QUESTION', 'SUGGESTION', 'AUTRE'])
  category!: 'BUG' | 'QUESTION' | 'SUGGESTION' | 'AUTRE';

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(120)
  subject!: string;

  @IsEmail()
  @MaxLength(120)
  fromEmail!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(4000)
  message!: string;
}
