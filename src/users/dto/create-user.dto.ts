/**
 * create-user.dto.ts
 * --------------------
 * Data Transfer Object (DTO) pour la création d’un user.
 * - Valide l’email (format)
 * - Valide le mot de passe (string min 8 chars)
 * Sert à filtrer et valider les données avant la DB.
 */
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
