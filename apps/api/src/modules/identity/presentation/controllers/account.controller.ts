import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common"
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"

import type { ClientContext } from "../../application/client-context"
import { ProfileService } from "../../application/services/profile.service"
import {
  VerificationService,
  type ContactChannel,
} from "../../application/services/verification.service"
import type { AuthenticatedUser } from "../../domain/authenticated-user"
import { ApiErrors } from "../decorators/api-errors.decorator"
import { Client, CurrentUser } from "../decorators/auth.decorators"
import { UpdateProfileDto, VerifyOtpDto } from "../dto/auth-request.dto"
import {
  OtpChallengeResponseDto,
  SessionResponseDto,
  UserResponseDto,
  VerificationResultDto,
} from "../dto/auth-response.dto"
import {
  serializeSession,
  serializeUser,
} from "../serializers/identity.serializer"

@ApiTags("auth")
@ApiBearerAuth()
@Controller({ path: "auth", version: "1" })
export class AccountController {
  constructor(
    private readonly profile: ProfileService,
    private readonly verification: VerificationService,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiErrors(401)
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    return serializeUser(await this.profile.me(user))
  }

  @Patch("me")
  @ApiOperation({
    summary: "Modifier le nom et le prénom",
    description:
      "Le changement d'email ou de téléphone passera par /auth/email/change et /auth/phone/change.",
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiErrors(400, 401)
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return serializeUser(await this.profile.update(user, dto))
  }

  @Post("email/verify/request")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Envoyer un code de vérification à l'email du compte",
  })
  @ApiAcceptedResponse({ type: OtpChallengeResponseDto })
  @ApiErrors(401, 409, 422, 429)
  requestEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Client() client: ClientContext,
  ) {
    return this.requestCode(user, "EMAIL", client)
  }

  @Post("email/verify/confirm")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirmer l'email avec le code reçu" })
  @ApiOkResponse({ type: VerificationResultDto })
  @ApiErrors(400, 401, 409, 422, 429)
  confirmEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyOtpDto,
    @Client() client: ClientContext,
  ) {
    return this.confirmCode(user, "EMAIL", dto, client)
  }

  @Post("phone/verify/request")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Envoyer un code de vérification par SMS au numéro du compte",
  })
  @ApiAcceptedResponse({ type: OtpChallengeResponseDto })
  @ApiErrors(401, 409, 422, 429)
  requestPhone(
    @CurrentUser() user: AuthenticatedUser,
    @Client() client: ClientContext,
  ) {
    return this.requestCode(user, "PHONE", client)
  }

  @Post("phone/verify/confirm")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirmer le téléphone avec le code reçu" })
  @ApiOkResponse({ type: VerificationResultDto })
  @ApiErrors(400, 401, 409, 422, 429)
  confirmPhone(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyOtpDto,
    @Client() client: ClientContext,
  ) {
    return this.confirmCode(user, "PHONE", dto, client)
  }

  @Get("sessions")
  @ApiOperation({ summary: "Sessions actives de l'utilisateur" })
  @ApiOkResponse({ type: SessionResponseDto, isArray: true })
  @ApiErrors(401)
  async sessions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SessionResponseDto[]> {
    const sessions = await this.profile.listSessions(user)
    return sessions.map((session) => serializeSession(session, user.sessionId))
  }

  @Delete("sessions/:sessionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Révoquer une session (appareil)" })
  @ApiNoContentResponse()
  @ApiErrors(400, 401, 404)
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param("sessionId", new ParseUUIDPipe()) sessionId: string,
    @Client() client: ClientContext,
  ): Promise<void> {
    await this.profile.revokeSession(user, sessionId, client)
  }

  private async requestCode(
    user: AuthenticatedUser,
    channel: ContactChannel,
    client: ClientContext,
  ): Promise<OtpChallengeResponseDto> {
    const challenge = await this.verification.request(user, channel, client)
    return {
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt.toISOString(),
      resendAvailableAt: challenge.resendAvailableAt.toISOString(),
    }
  }

  private async confirmCode(
    user: AuthenticatedUser,
    channel: ContactChannel,
    dto: VerifyOtpDto,
    client: ClientContext,
  ): Promise<VerificationResultDto> {
    const result = await this.verification.confirm(user, channel, dto, client)
    return { verified: true, status: result.status }
  }
}
