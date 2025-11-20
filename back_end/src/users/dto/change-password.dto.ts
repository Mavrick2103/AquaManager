import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString() 
  @MinLength(6) 
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[!@#$%^&*(),.?":{}|<>_\-=/+]).+$/, {
    message: 'Le nouveau mot de passe doit contenir au moins un caractère spécial.',
  })
  newPassword: string;
}
