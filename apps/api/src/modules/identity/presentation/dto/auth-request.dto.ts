import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator"

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../../domain/password-policy"
import { PUBLIC_REGISTER_ROLES } from "../../domain/register-account-type"

class DeviceDto {
  @ApiPropertyOptional({
    description: "Identifiant stable de l'appareil (mobile)",
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string

  @ApiPropertyOptional({ example: "iPhone de Awa", maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  deviceName?: string
}

export class RegisterDto extends DeviceDto {
  @ApiPropertyOptional({
    example: "awa@example.com",
    description: "Email ou téléphone requis",
  })
  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string

  @ApiPropertyOptional({
    example: "+2250701020304",
    description: "E.164 ou format local ivoirien (07 01 02 03 04)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string

  @ApiProperty({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH * 4)
  password: string

  @ApiPropertyOptional({ example: "Awa", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string

  @ApiPropertyOptional({ example: "Koné", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string

  @ApiPropertyOptional({
    enum: PUBLIC_REGISTER_ROLES,
    default: "CUSTOMER",
    description:
      "CUSTOMER (défaut), OWNER (propriétaire) ou AGENCY (agence). Les rôles staff ne sont pas acceptés.",
  })
  @IsOptional()
  @IsIn([...PUBLIC_REGISTER_ROLES])
  accountType?: (typeof PUBLIC_REGISTER_ROLES)[number]

  @ApiPropertyOptional({
    example: "Immobilier Plateau SARL",
    description: "Raison sociale — obligatoire si accountType = AGENCY",
    maxLength: 160,
  })
  @ValidateIf((o: RegisterDto) => o.accountType === "AGENCY")
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  organizationName?: string

  @ApiPropertyOptional({
    example: "Cocody, Abidjan",
    description: "Adresse de l'agence (optionnel)",
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizationAddress?: string
}

export class LoginDto extends DeviceDto {
  @ApiProperty({
    example: "awa@example.com",
    description: "Email ou numéro de téléphone",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  identifier: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH * 4)
  password: string
}

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      "Client mobile. Le client web utilise le cookie HttpOnly et l'en-tête X-CSRF-Token.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  refreshToken?: string
}

export class ForgotPasswordDto {
  @ApiProperty({ example: "awa@example.com" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  identifier: string
}

export class ResetPasswordDto {
  @ApiProperty({ description: "Jeton reçu par email ou SMS" })
  @IsString()
  @Length(20, 256)
  token: string

  @ApiProperty({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH * 4)
  newPassword: string
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH * 4)
  currentPassword: string

  @ApiProperty({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH * 4)
  newPassword: string
}

export class VerifyOtpDto {
  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^\d{4,10}$/, {
    message: "code doit contenir uniquement des chiffres",
  })
  code: string

  @ApiPropertyOptional({
    description: "Défi ciblé ; par défaut le dernier envoyé",
  })
  @IsOptional()
  @IsUUID()
  challengeId?: string
}

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: "Awa",
    description: "Chaîne vide pour effacer",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string

  @ApiPropertyOptional({
    example: "Koné",
    description: "Chaîne vide pour effacer",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string
}
