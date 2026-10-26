import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common"
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"
import type { Request, Response } from "express"

import type { ClientContext } from "../../application/client-context"
import { AuthService } from "../../application/services/auth.service"
import { PasswordService } from "../../application/services/password.service"
import type { IssuedSession } from "../../application/services/session.service"
import type { AuthenticatedUser } from "../../domain/authenticated-user"
import { IdentityConfig } from "../../identity.config"
import { ApiErrors } from "../decorators/api-errors.decorator"
import { Client, CurrentUser, Public } from "../decorators/auth.decorators"
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from "../dto/auth-request.dto"
import {
  AuthResponseDto,
  LogoutAllResponseDto,
  MessageResponseDto,
} from "../dto/auth-response.dto"
import {
  clearAuthCookies,
  resolveRefreshToken,
  setAuthCookies,
  wantsCookieTransport,
} from "../http/auth-cookies"
import { serializeAuth } from "../serializers/identity.serializer"

const transportHeader = ApiHeader({
  name: "X-Auth-Transport",
  required: false,
  description:
    "`cookie` pour le web : refresh token en cookie HttpOnly + cookie CSRF",
})

const GENERIC_RESET_MESSAGE =
  "Si un compte correspond, un lien de réinitialisation vient d'être envoyé."

@ApiTags("auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwords: PasswordService,
    private readonly config: IdentityConfig,
  ) {}

  @Post("register")
  @Public()
  @ApiOperation({
    summary:
      "Créer un compte (CUSTOMER, OWNER ou AGENCY) en PENDING et ouvrir une session",
    description:
      "accountType=OWNER|AGENCY pour les éditeurs. AGENCY exige organizationName. Les rôles staff ne sont pas acceptés.",
  })
  @transportHeader
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiErrors(400, 409, 422, 429, 503)
  async register(
    @Body() dto: RegisterDto,
    @Client() client: ClientContext,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return this.respond(
      await this.auth.register(dto, client),
      request,
      response,
    )
  }

  @Post("login")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Connexion par email ou téléphone et mot de passe" })
  @transportHeader
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiErrors(400, 401, 403, 429, 503)
  async login(
    @Body() dto: LoginDto,
    @Client() client: ClientContext,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return this.respond(await this.auth.login(dto, client), request, response)
  }

  @Post("refresh")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Rotation du refresh token",
    description:
      "Mobile : `refreshToken` dans le corps. Web : cookie HttpOnly + en-tête `X-CSRF-Token` égal au cookie `ma_csrf`. Un token déjà utilisé révoque toute la session.",
  })
  @ApiHeader({ name: "X-CSRF-Token", required: false })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiErrors(401, 403, 429, 503)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Client() client: ClientContext,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const { token, fromCookie } = resolveRefreshToken(request, dto.refreshToken)
    try {
      const issued = await this.auth.refresh(token, client)
      if (fromCookie) {
        setAuthCookies(
          response,
          this.config,
          issued.refreshToken,
          issued.refreshTokenExpiresAt,
        )
      }
      return serializeAuth(issued, !fromCookie)
    } catch (error) {
      if (fromCookie) clearAuthCookies(response, this.config)
      throw error
    }
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Révoquer la session courante" })
  @ApiNoContentResponse()
  @ApiErrors(401)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Client() client: ClientContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(user, client)
    clearAuthCookies(response, this.config)
  }

  @Post("logout-all")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Révoquer toutes les sessions de l'utilisateur" })
  @ApiOkResponse({ type: LogoutAllResponseDto })
  @ApiErrors(401)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Client() client: ClientContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutAllResponseDto> {
    const revokedSessions = await this.auth.logoutAll(user, client)
    clearAuthCookies(response, this.config)
    return { revokedSessions }
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Changer de mot de passe ; les autres sessions sont révoquées",
  })
  @ApiOkResponse({ type: LogoutAllResponseDto })
  @ApiErrors(400, 401, 422, 429)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Client() client: ClientContext,
  ): Promise<LogoutAllResponseDto> {
    return this.passwords.change(user, dto, client)
  }

  @Post("forgot-password")
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      "Demander un lien de réinitialisation (réponse identique si le compte n'existe pas)",
  })
  @ApiAcceptedResponse({ type: MessageResponseDto })
  @ApiErrors(400, 429)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Client() client: ClientContext,
  ): Promise<MessageResponseDto> {
    await this.passwords.requestReset(dto.identifier, client)
    return { message: GENERIC_RESET_MESSAGE }
  }

  @Post("reset-password")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Définir un nouveau mot de passe ; toutes les sessions sont révoquées",
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiErrors(400, 422, 429)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Client() client: ClientContext,
  ): Promise<MessageResponseDto> {
    await this.passwords.reset(dto.token, dto.newPassword, client)
    return { message: "Mot de passe mis à jour. Reconnectez-vous." }
  }

  private respond(
    issued: IssuedSession,
    request: Request,
    response: Response,
  ): AuthResponseDto {
    if (wantsCookieTransport(request)) {
      setAuthCookies(
        response,
        this.config,
        issued.refreshToken,
        issued.refreshTokenExpiresAt,
      )
      return serializeAuth(issued, false)
    }
    return serializeAuth(issued, true)
  }
}
