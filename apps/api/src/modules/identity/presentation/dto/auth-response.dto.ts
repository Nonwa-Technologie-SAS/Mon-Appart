import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { ROLES, type Role } from "@mon-appart/types"

import { UserStatus } from "../../../../generated/prisma/enums"

export class UserResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ type: String, nullable: true })
  email: string | null

  @ApiProperty({ type: String, nullable: true, example: "+2250701020304" })
  phone: string | null

  @ApiProperty({ type: String, nullable: true })
  firstName: string | null

  @ApiProperty({ type: String, nullable: true })
  lastName: string | null

  @ApiProperty({ enum: Object.values(UserStatus) })
  status: UserStatus

  @ApiProperty()
  emailVerified: boolean

  @ApiProperty()
  phoneVerified: boolean

  @ApiProperty({ enum: ROLES, isArray: true })
  roles: Role[]

  @ApiProperty({ type: String, format: "date-time" })
  createdAt: string
}

export class AuthResponseDto {
  @ApiProperty({ example: "Bearer" })
  tokenType: "Bearer"

  @ApiProperty({ description: "JWT d'accès (15 min par défaut)" })
  accessToken: string

  @ApiProperty({ type: String, format: "date-time" })
  accessTokenExpiresAt: string

  @ApiPropertyOptional({
    description:
      "Absent en mode cookie (X-Auth-Transport: cookie) : il est posé en cookie HttpOnly",
  })
  refreshToken?: string

  @ApiProperty({ type: String, format: "date-time" })
  refreshTokenExpiresAt: string

  @ApiProperty({
    format: "uuid",
    description: "Identifiant de session, stable pendant les rotations",
  })
  sessionId: string

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto
}

export class SessionResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string

  @ApiProperty({ type: String, nullable: true })
  deviceName: string | null

  @ApiProperty({ type: String, nullable: true })
  ipAddress: string | null

  @ApiProperty({ type: String, nullable: true })
  userAgent: string | null

  @ApiProperty({
    type: String,
    format: "date-time",
    description: "Dernier refresh ou ouverture",
  })
  lastActiveAt: string

  @ApiProperty({ type: String, format: "date-time" })
  expiresAt: string

  @ApiProperty()
  current: boolean
}

export class OtpChallengeResponseDto {
  @ApiProperty({ format: "uuid" })
  challengeId: string

  @ApiProperty({ type: String, format: "date-time" })
  expiresAt: string

  @ApiProperty({ type: String, format: "date-time" })
  resendAvailableAt: string
}

export class VerificationResultDto {
  @ApiProperty()
  verified: boolean

  @ApiProperty({ enum: Object.values(UserStatus) })
  status: UserStatus
}

export class MessageResponseDto {
  @ApiProperty()
  message: string
}

export class LogoutAllResponseDto {
  @ApiProperty()
  revokedSessions: number
}

export class ErrorResponseDto {
  @ApiProperty({ example: 401 })
  statusCode: number

  @ApiProperty({ example: "INVALID_CREDENTIALS" })
  code: string

  @ApiProperty({ example: "Identifiants invalides" })
  message: string

  @ApiPropertyOptional({
    description: "Détails de validation (400 uniquement)",
  })
  details?: unknown

  @ApiProperty({ type: String, nullable: true })
  requestId: string | null

  @ApiProperty({ type: String, format: "date-time" })
  timestamp: string

  @ApiProperty()
  path: string
}
