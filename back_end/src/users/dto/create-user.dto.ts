import {
  IsEmail,
  IsString,
  MinLength,
  Matches,
  IsBoolean,
  IsOptional,
  IsObject,
  ValidateNested,
} from "class-validator";

import { Type } from "class-transformer";

export class RegistrationNotificationsDto {
  @IsBoolean()
  taskReminders: boolean;
  @IsBoolean()
  automaticNotifications: boolean;
  @IsBoolean()
  newsAndUpdates: boolean;
}

export class CreateUserDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RegistrationNotificationsDto)
  notificationPreferences?: RegistrationNotificationsDto;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[!@#$%^&*(),.?":{}|<>_\-=/+]).+$/, {
    message: "Le mot de passe doit contenir au moins un caractère spécial.",
  })
  password: string;
}
