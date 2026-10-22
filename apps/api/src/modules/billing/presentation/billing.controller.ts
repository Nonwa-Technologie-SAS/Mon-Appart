import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
  Public,
  type AuthenticatedUser,
  type ClientContext,
} from "../../identity"
import { billingRateLimit } from "../billing.config"
import { CatalogService } from "../application/catalog.service"
import { MockCheckoutService } from "../application/mock-checkout.service"
import { OrderService } from "../application/order.service"
import { PaymentService } from "../application/payment.service"
import { RefundService } from "../application/refund.service"
import { SubscriptionService } from "../application/subscription.service"
import { BillingApiErrors } from "./billing-api-errors"
import {
  CreateOrderDto,
  CursorQueryDto,
  MockSimulationDto,
  RefundRequestDto,
} from "./billing.dto"

const uuid = new ParseUUIDPipe({ version: "4" })
const limited = { default: { limit: billingRateLimit, ttl: 60_000 } }

/**
 * Espace client Billing. Le montant d'une commande est toujours fixé par le
 * serveur ; un paiement n'est réputé réussi qu'après confirmation du
 * prestataire (webhook signé ou interrogation), jamais sur la foi d'une
 * redirection du navigateur.
 */
@ApiTags("billing")
@ApiBearerAuth()
@Controller({ path: "billing", version: "1" })
export class BillingController {
  constructor(
    private readonly actors: ActorService,
    private readonly catalog: CatalogService,
    private readonly orders: OrderService,
    private readonly payments: PaymentService,
    private readonly subscriptions: SubscriptionService,
    private readonly refunds: RefundService,
    private readonly mockCheckout: MockCheckoutService,
  ) {}

  @Get("plans")
  @Public()
  @ApiOperation({ summary: "Plans en vente et tarif courant" })
  @ApiOkResponse({ description: "Plans actifs ; montants entiers en chaîne" })
  plans() {
    return this.catalog.listPublic()
  }

  @Get("me/entitlements")
  @ApiOperation({
    summary: "Mes droits effectifs",
    description: "Plan applicable, quota d'annonces actives et consommation.",
  })
  @BillingApiErrors(401)
  async entitlements(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.entitlementOf(await this.actors.resolve(user))
  }

  @Get("me/subscriptions")
  @ApiOperation({ summary: "Mes abonnements" })
  @BillingApiErrors(401)
  async mySubscriptions(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.listOwn(await this.actors.resolve(user))
  }

  @Post("me/subscriptions/:subscriptionId/cancel")
  @HttpCode(HttpStatus.OK)
  @Throttle(limited)
  @ApiOperation({
    summary: "Résilier à l'échéance",
    description:
      "Les droits restent acquis jusqu'à la fin de la période payée ; aucun remboursement automatique.",
  })
  @BillingApiErrors(401, 404, 409, 429)
  async cancelSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Param("subscriptionId", uuid) subscriptionId: string,
    @Client() client: ClientContext,
  ) {
    return this.subscriptions.cancel(
      await this.actors.resolve(user),
      subscriptionId,
      client,
    )
  }

  @Post("orders")
  @Permissions("billing:purchase")
  @Throttle(limited)
  @ApiOperation({
    summary: "Créer une commande (souscription ou renouvellement)",
    description:
      "Idempotent par `idempotencyKey`. Le tarif est celui du catalogue au moment de la commande et reste figé.",
  })
  @ApiCreatedResponse({ description: "Commande en attente de paiement" })
  @BillingApiErrors(400, 401, 403, 404, 409, 422, 429, 503)
  async createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateOrderDto,
    @Client() client: ClientContext,
  ) {
    return this.orders.create(await this.actors.resolve(user), body, client)
  }

  @Get("orders")
  @ApiOperation({ summary: "Mon historique de commandes" })
  @BillingApiErrors(400, 401)
  async myOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CursorQueryDto,
  ) {
    return this.orders.listOwn(await this.actors.resolve(user), query)
  }

  @Get("orders/:orderId")
  @ApiOperation({ summary: "Détail d'une de mes commandes et ses tentatives" })
  @BillingApiErrors(401, 404)
  async myOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId", uuid) orderId: string,
  ) {
    return this.orders.getOwn(await this.actors.resolve(user), orderId)
  }

  @Get("orders/:orderId/receipt")
  @ApiOperation({
    summary: "Reçu de paiement d'une de mes commandes",
    description:
      "Disponible après confirmation du paiement par le prestataire. Ce reçu n'est pas une facture et n'a pas de valeur fiscale.",
  })
  @BillingApiErrors(401, 404, 409)
  async myReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId", uuid) orderId: string,
  ) {
    return this.orders.receipt(await this.actors.resolve(user), orderId)
  }

  @Post("orders/:orderId/cancel")
  @HttpCode(HttpStatus.OK)
  @Throttle(limited)
  @ApiOperation({ summary: "Abandonner une commande non payée" })
  @BillingApiErrors(401, 404, 409, 429)
  async cancelOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId", uuid) orderId: string,
    @Client() client: ClientContext,
  ) {
    return this.orders.cancel(await this.actors.resolve(user), orderId, client)
  }

  @Post("orders/:orderId/payments")
  @Permissions("billing:purchase")
  @Throttle(limited)
  @ApiOperation({
    summary: "Démarrer une tentative de paiement",
    description:
      "Renvoie la tentative ouverte s'il en existe une. La réponse contient l'éventuelle URL du prestataire ; le statut final arrive par webhook.",
  })
  @ApiCreatedResponse({ description: "Tentative de paiement" })
  @BillingApiErrors(401, 403, 404, 409, 429, 502, 503)
  async startPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderId", uuid) orderId: string,
    @Client() client: ClientContext,
  ) {
    return this.payments.start(await this.actors.resolve(user), orderId, client)
  }

  @Get("payments/:paymentId")
  @ApiOperation({ summary: "Statut d'une de mes tentatives de paiement" })
  @BillingApiErrors(401, 404)
  async myPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("paymentId", uuid) paymentId: string,
  ) {
    return this.payments.getOwn(await this.actors.resolve(user), paymentId)
  }

  @Post("payments/:paymentId/refresh")
  @HttpCode(HttpStatus.OK)
  @Throttle(limited)
  @ApiOperation({
    summary: "Interroger le prestataire",
    description:
      "À appeler au retour de la page de paiement : seul le statut confirmé par le prestataire compte.",
  })
  @BillingApiErrors(401, 404, 429)
  async refreshPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("paymentId", uuid) paymentId: string,
  ) {
    return this.payments.refreshOwn(await this.actors.resolve(user), paymentId)
  }

  @Post("payments/:paymentId/refund-requests")
  @Throttle(limited)
  @ApiOperation({
    summary: "Demander un remboursement",
    description:
      "Crée une demande examinée par l'équipe ; aucun remboursement n'est exécuté sans validation et confirmation du prestataire.",
  })
  @BillingApiErrors(400, 401, 404, 409, 422, 429)
  async requestRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param("paymentId", uuid) paymentId: string,
    @Body() body: RefundRequestDto,
    @Client() client: ClientContext,
  ) {
    return this.refunds.request(
      await this.actors.resolve(user),
      paymentId,
      body,
      { asCustomer: true },
      client,
    )
  }

  @Get("me/refunds")
  @ApiOperation({ summary: "Mes demandes de remboursement" })
  @BillingApiErrors(401)
  async myRefunds(@CurrentUser() user: AuthenticatedUser) {
    return this.refunds.listOwn(await this.actors.resolve(user))
  }

  @Post("mock/payments/:paymentId/simulate")
  @HttpCode(HttpStatus.OK)
  @Throttle(limited)
  @ApiOperation({
    summary: "Simulateur : jouer le payeur (développement uniquement)",
    description:
      "404 si le simulateur n'est pas actif (refusé en staging, production et live). Le résultat transite par le webhook signé.",
  })
  @BillingApiErrors(400, 401, 404, 429)
  async simulate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("paymentId", uuid) paymentId: string,
    @Body() body: MockSimulationDto,
  ) {
    return this.mockCheckout.simulate(
      await this.actors.resolve(user),
      paymentId,
      body.outcome,
    )
  }
}
