import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import {
  ActorService,
  Client,
  CurrentUser,
  Permissions,
  type AuthenticatedUser,
  type ClientContext,
} from "../../identity"
import { serializeSession } from "../../media"
import { VerificationService } from "../application/verification.service"
import { trustMutationRateLimit } from "../trust.config"
import {
  AddVerificationDocumentDto,
  CreateVerificationDto,
  SubmitVerificationDto,
} from "./dto/trust-request.dto"
import {
  DocumentUploadResponseDto,
  VerificationListResponseDto,
  VerificationResponseDto,
} from "./dto/trust-response.dto"
import { TrustApiErrors } from "./trust-api-errors"
import { serialize } from "./trust.serializer"

const uuid = new ParseUUIDPipe({ version: "4" })
const MINUTE_MS = 60_000
const throttle = { default: { limit: trustMutationRateLimit, ttl: MINUTE_MS } }

/**
 * Dossiers de vérification du compte courant. Aucune route ici ne fixe
 * l'issue d'un dossier : seuls les relecteurs décident (`/admin/trust`).
 */
@ApiTags("trust")
@ApiBearerAuth()
@Controller({ path: "trust/verifications", version: "1" })
export class VerificationController {
  constructor(
    private readonly actors: ActorService,
    private readonly verifications: VerificationService,
  ) {}

  @Post()
  @Permissions("verification:create")
  @Throttle(throttle)
  @ApiOperation({
    summary: "Ouvrir un dossier de vérification (brouillon)",
    description:
      "Identité, propriété, mandat, documents du bien, agence ou contrôle d'annonce. Pour un bien ou une annonce, vous devez le gérer. Le dossier reste un brouillon jusqu'à sa soumission.",
  })
  @ApiCreatedResponse({ type: VerificationResponseDto })
  @TrustApiErrors(400, 401, 403, 404, 409, 422, 429)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVerificationDto,
    @Client() client: ClientContext,
  ): Promise<VerificationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.verifications.create(actor, dto, client))
  }

  @Get()
  @ApiOperation({ summary: "Mes dossiers de vérification" })
  @ApiOkResponse({ type: VerificationListResponseDto })
  @TrustApiErrors(401)
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VerificationListResponseDto> {
    const actor = await this.actors.resolve(user)
    return { items: serialize(await this.verifications.list(actor)) }
  }

  @Get(":verificationId")
  @ApiOperation({
    summary: "Détail d'un de mes dossiers",
    description:
      "Statut, pièces, exigences restantes, historique et motifs publics. Les notes internes et précontrôles ne sont jamais renvoyés.",
  })
  @ApiOkResponse({ type: VerificationResponseDto })
  @TrustApiErrors(400, 401, 404)
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("verificationId", uuid) verificationId: string,
  ): Promise<VerificationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(await this.verifications.get(actor, verificationId))
  }

  @Post(":verificationId/documents")
  @Permissions("verification:create")
  @Throttle(throttle)
  @ApiOperation({
    summary: "Ajouter une pièce justificative",
    description:
      "Ouvre une session d'envoi privée (jamais publique, hors galerie du bien). Envoyez le fichier puis confirmez la session Media. Une pièce envoyée ne vaut pas vérification.",
  })
  @ApiCreatedResponse({ type: DocumentUploadResponseDto })
  @TrustApiErrors(400, 401, 403, 404, 409, 422, 429)
  async addDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param("verificationId", uuid) verificationId: string,
    @Body() dto: AddVerificationDocumentDto,
    @Client() client: ClientContext,
  ): Promise<DocumentUploadResponseDto> {
    const actor = await this.actors.resolve(user)
    const result = await this.verifications.addDocument(
      actor,
      verificationId,
      dto,
      client,
    )
    return {
      documentId: result.documentId,
      upload: serializeSession(result.upload),
    }
  }

  @Delete(":verificationId/documents/:documentId")
  @Throttle(throttle)
  @ApiOperation({
    summary: "Retirer une pièce (brouillon ou complément demandé)",
  })
  @ApiOkResponse({ type: VerificationResponseDto })
  @TrustApiErrors(400, 401, 404, 409, 429)
  async removeDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param("verificationId", uuid) verificationId: string,
    @Param("documentId", uuid) documentId: string,
    @Client() client: ClientContext,
  ): Promise<VerificationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.verifications.removeDocument(
        actor,
        verificationId,
        documentId,
        client,
      ),
    )
  }

  @Post(":verificationId/submit")
  @HttpCode(HttpStatus.OK)
  @Permissions("verification:create")
  @Throttle(throttle)
  @ApiOperation({
    summary: "Soumettre le dossier pour examen",
    description:
      "Exige la déclaration sur l'honneur, les pièces obligatoires prêtes et, pour un bien ou une agence, une identité vérifiée. Des précontrôles automatiques aident l'instruction ; ils ne décident pas.",
  })
  @ApiOkResponse({ type: VerificationResponseDto })
  @TrustApiErrors(400, 401, 403, 404, 409, 422, 429)
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("verificationId", uuid) verificationId: string,
    @Body() dto: SubmitVerificationDto,
    @Client() client: ClientContext,
  ): Promise<VerificationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.verifications.submit(actor, verificationId, dto, client),
    )
  }

  @Post(":verificationId/withdraw")
  @HttpCode(HttpStatus.OK)
  @Throttle(throttle)
  @ApiOperation({ summary: "Retirer un dossier non décidé" })
  @ApiOkResponse({ type: VerificationResponseDto })
  @TrustApiErrors(400, 401, 404, 409, 429)
  async withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Param("verificationId", uuid) verificationId: string,
    @Client() client: ClientContext,
  ): Promise<VerificationResponseDto> {
    const actor = await this.actors.resolve(user)
    return serialize(
      await this.verifications.withdraw(actor, verificationId, client),
    )
  }
}
