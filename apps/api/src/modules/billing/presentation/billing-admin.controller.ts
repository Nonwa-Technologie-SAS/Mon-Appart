import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"

import { adminMutationRateLimit } from "../../admin/admin.config"
import {
  AdminAccessGuard,
  AdminActor,
} from "../../admin/presentation/admin-access.guard"
import {
  Client,
  Permissions,
  type Actor,
  type ClientContext,
} from "../../identity"
import { BillingAdminService } from "../application/billing-admin.service"
import { CatalogService } from "../application/catalog.service"
import { ReconciliationService } from "../application/reconciliation.service"
import { RefundService } from "../application/refund.service"
import { BillingApiErrors } from "./billing-api-errors"
import {
  CreatePriceDto,
  CreateProductDto,
  DecisionNoteDto,
  IncidentListQueryDto,
  OrderListQueryDto,
  PaymentListQueryDto,
  RefundListQueryDto,
  RefundRequestDto,
  ResolveIncidentDto,
  SubscriptionListQueryDto,
  UpdateProductDto,
  WebhookEventQueryDto,
} from "./billing.dto"

const uuid = new ParseUUIDPipe({ version: "4" })
const mutation = { default: { limit: adminMutationRateLimit, ttl: 60_000 } }

/**
 * Back-office Billing : diagnostic, catalogue, remboursements, incidents.
 * Volontairement sans action « marquer comme payé » : un paiement ne change
 * d'état que sur confirmation du prestataire (webhook ou interrogation).
 */
@ApiTags("admin-billing")
@ApiBearerAuth()
@UseGuards(AdminAccessGuard)
@Controller({ path: "admin/billing", version: "1" })
export class BillingAdminController {
  constructor(
    private readonly admin: BillingAdminService,
    private readonly catalog: CatalogService,
    private readonly refunds: RefundService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  @Get("summary")
  @Permissions("billing:read")
  @ApiOperation({
    summary: "Synthèse",
    description:
      "Montants bruts encaissés et remboursés par devise et environnement ; aucun revenu net calculé.",
  })
  @BillingApiErrors(401, 403)
  summary() {
    return this.admin.summary()
  }

  @Get("orders")
  @Permissions("billing:read")
  @ApiOperation({ summary: "Commandes" })
  @BillingApiErrors(400, 401, 403)
  orders(@Query() query: OrderListQueryDto) {
    return this.admin.listOrders(query)
  }

  @Get("orders/:orderId")
  @Permissions("billing:read")
  @ApiOperation({
    summary: "Diagnostic d'une commande",
    description: "Tentatives, traces de webhook, remboursements, incidents.",
  })
  @BillingApiErrors(401, 403, 404)
  order(@Param("orderId", uuid) orderId: string) {
    return this.admin.orderDetail(orderId)
  }

  @Get("payments")
  @Permissions("billing:read")
  @ApiOperation({ summary: "Tentatives de paiement" })
  @BillingApiErrors(400, 401, 403)
  payments(@Query() query: PaymentListQueryDto) {
    return this.admin.listPayments(query)
  }

  @Post("payments/:paymentId/check")
  @Permissions("billing:reconcile")
  @HttpCode(HttpStatus.OK)
  @Throttle(mutation)
  @ApiOperation({
    summary: "Interroger le prestataire",
    description:
      "Applique uniquement le statut renvoyé par le prestataire ; ne permet pas de forcer un statut.",
  })
  @BillingApiErrors(401, 403, 404, 429)
  check(@Param("paymentId", uuid) paymentId: string) {
    return this.reconciliation.checkPayment(paymentId)
  }

  @Post("payments/:paymentId/refunds")
  @Permissions("billing:refund_request")
  @Throttle(mutation)
  @ApiOperation({
    summary: "Ouvrir une demande de remboursement",
    description: "Validation par une autre personne (`billing:refund`).",
  })
  @BillingApiErrors(400, 401, 403, 404, 409, 422, 429)
  requestRefund(
    @AdminActor() actor: Actor,
    @Param("paymentId", uuid) paymentId: string,
    @Body() body: RefundRequestDto,
    @Client() client: ClientContext,
  ) {
    return this.refunds.request(
      actor,
      paymentId,
      body,
      { asCustomer: false },
      client,
    )
  }

  @Get("subscriptions")
  @Permissions("billing:read")
  @ApiOperation({ summary: "Abonnements" })
  @BillingApiErrors(400, 401, 403)
  subscriptions(@Query() query: SubscriptionListQueryDto) {
    return this.admin.listSubscriptions(query)
  }

  @Get("refunds")
  @Permissions("billing:read")
  @ApiOperation({ summary: "Remboursements" })
  @BillingApiErrors(400, 401, 403)
  refundList(@Query() query: RefundListQueryDto) {
    return this.admin.listRefunds(query)
  }

  @Get("refunds/:refundId")
  @Permissions("billing:read")
  @ApiOperation({ summary: "Détail d'un remboursement" })
  @BillingApiErrors(401, 403, 404)
  refund(@Param("refundId", uuid) refundId: string) {
    return this.refunds.get(refundId)
  }

  @Post("refunds/:refundId/approve")
  @Permissions("billing:refund")
  @HttpCode(HttpStatus.OK)
  @Throttle(mutation)
  @ApiOperation({
    summary: "Valider et exécuter un remboursement",
    description:
      "Interdit au demandeur. Le remboursement n'est « effectué » qu'après confirmation du prestataire.",
  })
  @BillingApiErrors(400, 401, 403, 404, 409, 422, 429, 502)
  approve(
    @AdminActor() actor: Actor,
    @Param("refundId", uuid) refundId: string,
    @Body() body: DecisionNoteDto,
    @Client() client: ClientContext,
  ) {
    return this.refunds.approve(actor, refundId, body.note, client)
  }

  @Post("refunds/:refundId/reject")
  @Permissions("billing:refund")
  @HttpCode(HttpStatus.OK)
  @Throttle(mutation)
  @ApiOperation({ summary: "Refuser une demande de remboursement" })
  @BillingApiErrors(400, 401, 403, 404, 409, 429)
  reject(
    @AdminActor() actor: Actor,
    @Param("refundId", uuid) refundId: string,
    @Body() body: DecisionNoteDto,
    @Client() client: ClientContext,
  ) {
    return this.refunds.reject(actor, refundId, body.note, client)
  }

  @Get("incidents")
  @Permissions("billing:read")
  @ApiOperation({ summary: "Incidents de rapprochement" })
  @BillingApiErrors(400, 401, 403)
  incidents(@Query() query: IncidentListQueryDto) {
    return this.admin.listIncidents(query)
  }

  @Post("incidents/:incidentId/resolve")
  @Permissions("billing:reconcile")
  @HttpCode(HttpStatus.OK)
  @Throttle(mutation)
  @ApiOperation({
    summary: "Clore un incident",
    description:
      "Trace la résolution ; ne modifie ni paiement ni commande (un remboursement se demande séparément).",
  })
  @BillingApiErrors(400, 401, 403, 404, 409, 429)
  resolveIncident(
    @AdminActor() actor: Actor,
    @Param("incidentId", uuid) incidentId: string,
    @Body() body: ResolveIncidentDto,
    @Client() client: ClientContext,
  ) {
    return this.admin.resolveIncident(
      actor,
      incidentId,
      body.resolution,
      client,
    )
  }

  @Get("webhook-events")
  @Permissions("billing:read")
  @ApiOperation({
    summary: "Traces de webhooks",
    description:
      "Empreinte et résumé seulement ; jamais le corps ni la signature.",
  })
  @BillingApiErrors(400, 401, 403)
  webhookEvents(@Query() query: WebhookEventQueryDto) {
    return this.admin.listWebhookEvents(query)
  }

  @Get("catalog")
  @Permissions("billing:read")
  @ApiOperation({ summary: "Catalogue complet (brouillons, archives, tarifs)" })
  @BillingApiErrors(401, 403)
  catalogList() {
    return this.catalog.listAdmin()
  }

  @Post("catalog/products")
  @Permissions("billing:catalog")
  @Throttle(mutation)
  @ApiOperation({ summary: "Créer un plan (brouillon)" })
  @BillingApiErrors(400, 401, 403, 409, 429)
  createProduct(
    @AdminActor() actor: Actor,
    @Body() body: CreateProductDto,
    @Client() client: ClientContext,
  ) {
    return this.catalog.createProduct(actor, body, client)
  }

  @Patch("catalog/products/:code")
  @Permissions("billing:catalog")
  @Throttle(mutation)
  @ApiOperation({ summary: "Modifier un plan" })
  @BillingApiErrors(400, 401, 403, 404, 422, 429)
  updateProduct(
    @AdminActor() actor: Actor,
    @Param("code") code: string,
    @Body() body: UpdateProductDto,
    @Client() client: ClientContext,
  ) {
    return this.catalog.updateProduct(actor, code, body, client)
  }

  @Post("catalog/products/:code/prices")
  @Permissions("billing:catalog")
  @Throttle(mutation)
  @ApiOperation({
    summary: "Ajouter un tarif",
    description:
      "Les tarifs sont immuables : une hausse ou une baisse se fait par un nouveau tarif ; les commandes existantes gardent leur montant.",
  })
  @BillingApiErrors(400, 401, 403, 404, 422, 429)
  createPrice(
    @AdminActor() actor: Actor,
    @Param("code") code: string,
    @Body() body: CreatePriceDto,
    @Client() client: ClientContext,
  ) {
    return this.catalog.createPrice(actor, code, body, client)
  }

  @Post("catalog/prices/:priceId/archive")
  @Permissions("billing:catalog")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(mutation)
  @ApiOperation({ summary: "Archiver un tarif" })
  @BillingApiErrors(401, 403, 404, 429)
  archivePrice(
    @AdminActor() actor: Actor,
    @Param("priceId", uuid) priceId: string,
    @Client() client: ClientContext,
  ) {
    return this.catalog.archivePrice(actor, priceId, client)
  }
}
