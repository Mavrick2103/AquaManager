import { IsEmail, IsString, MinLength, Matches  } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[!@#$%^&*(),.?":{}|<>_\-=/+]).+$/, {
    message: 'Le mot de passe doit contenir au moins un caractère spécial.',
  })
  password: string;
}
