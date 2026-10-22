import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  type RawBodyRequest,
} from "@nestjs/common"
import { ApiExcludeController } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"
import type { Request } from "express"

import { Public } from "../../identity"
import { billingWebhookRateLimit } from "../billing.config"
import { WebhookService } from "../application/webhook.service"

/**
 * Notifications des prestataires. Publique mais jamais sur la seule foi de
 * l'URL : signature vérifiée sur le corps brut, puis déduplication par
 * identifiant d'événement. Le contenu n'est pas journalisé.
 */
@ApiExcludeController()
@Controller({ path: "billing/webhooks", version: "1" })
export class BillingWebhookController {
  constructor(private readonly webhooks: WebhookService) {}

  @Post(":provider")
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: billingWebhookRateLimit, ttl: 60_000 } })
  receive(
    @Param("provider") provider: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() request: RawBodyRequest<Request>,
  ) {
    return this.webhooks.handle(provider, headers, request.rawBody)
  }
}
