import { HttpStatus } from "@nestjs/common"

import { AppException } from "../../../common/http/app-exception"

const DEFINITIONS = {
  BILLING_UNAVAILABLE: [
    HttpStatus.SERVICE_UNAVAILABLE,
    "Aucun prestataire de paiement n'est configuré",
  ],
  PROVIDER_NOT_FOUND: [HttpStatus.NOT_FOUND, "Prestataire inconnu"],
  PROVIDER_ERROR: [
    HttpStatus.BAD_GATEWAY,
    "Le prestataire de paiement n'a pas pu traiter la demande",
  ],
  PRODUCT_NOT_FOUND: [HttpStatus.NOT_FOUND, "Plan introuvable"],
  PRODUCT_NOT_PURCHASABLE: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Ce plan ne peut pas être souscrit",
  ],
  PRODUCT_CODE_EXISTS: [
    HttpStatus.CONFLICT,
    "Un plan existe déjà avec ce code",
  ],
  PRODUCT_DEFAULT_LOCKED: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Le plan par défaut ne se vend pas et ne peut pas être retiré",
  ],
  PRICE_NOT_FOUND: [HttpStatus.NOT_FOUND, "Tarif introuvable"],
  PRICE_INVALID: [HttpStatus.UNPROCESSABLE_ENTITY, "Tarif invalide"],
  CURRENCY_NOT_SUPPORTED: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Devise non prise en charge",
  ],
  ORDER_NOT_FOUND: [HttpStatus.NOT_FOUND, "Commande introuvable"],
  ORDER_ALREADY_PENDING: [
    HttpStatus.CONFLICT,
    "Une commande est déjà en attente de paiement : finalisez-la ou annulez-la",
  ],
  ORDER_NOT_PAYABLE: [HttpStatus.CONFLICT, "Cette commande n'est plus payable"],
  ORDER_NOT_CANCELLABLE: [
    HttpStatus.CONFLICT,
    "Cette commande ne peut plus être annulée",
  ],
  RECEIPT_NOT_AVAILABLE: [
    HttpStatus.CONFLICT,
    "Aucun reçu : le paiement de cette commande n'est pas confirmé",
  ],
  IDEMPOTENCY_KEY_REUSED: [
    HttpStatus.CONFLICT,
    "Clé d'idempotence déjà utilisée pour une autre demande",
  ],
  PLAN_CHANGE_NOT_SUPPORTED: [
    HttpStatus.CONFLICT,
    "Changement de plan non disponible : résiliez l'abonnement en cours et attendez sa fin",
  ],
  RENEWAL_NOT_OPEN: [
    HttpStatus.CONFLICT,
    "Le renouvellement n'est pas encore ouvert pour cet abonnement",
  ],
  TOO_MANY_ATTEMPTS: [
    HttpStatus.CONFLICT,
    "Nombre maximal de tentatives atteint : créez une nouvelle commande",
  ],
  PAYMENT_NOT_FOUND: [HttpStatus.NOT_FOUND, "Paiement introuvable"],
  SUBSCRIPTION_NOT_FOUND: [HttpStatus.NOT_FOUND, "Abonnement introuvable"],
  SUBSCRIPTION_NOT_ACTIVE: [
    HttpStatus.CONFLICT,
    "Cet abonnement n'est pas en cours",
  ],
  REFUND_NOT_FOUND: [HttpStatus.NOT_FOUND, "Remboursement introuvable"],
  REFUND_NOT_ALLOWED: [
    HttpStatus.CONFLICT,
    "Ce paiement ne peut pas être remboursé",
  ],
  REFUND_AMOUNT_EXCEEDED: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Montant supérieur au montant remboursable",
  ],
  REFUND_ALREADY_PENDING: [
    HttpStatus.CONFLICT,
    "Une demande de remboursement est déjà en cours pour ce paiement",
  ],
  REFUND_NOT_SUPPORTED: [
    HttpStatus.UNPROCESSABLE_ENTITY,
    "Le prestataire ne permet pas le remboursement automatique",
  ],
  REFUND_NOT_DECIDABLE: [
    HttpStatus.CONFLICT,
    "Cette demande de remboursement a déjà été traitée",
  ],
  REFUND_SELF_APPROVAL: [
    HttpStatus.FORBIDDEN,
    "Un remboursement doit être approuvé par une autre personne que le demandeur",
  ],
  INCIDENT_NOT_FOUND: [HttpStatus.NOT_FOUND, "Incident introuvable"],
  INCIDENT_ALREADY_RESOLVED: [HttpStatus.CONFLICT, "Incident déjà résolu"],
  WEBHOOK_SIGNATURE_INVALID: [
    HttpStatus.UNAUTHORIZED,
    "Signature de notification invalide",
  ],
  WEBHOOK_PAYLOAD_INVALID: [HttpStatus.BAD_REQUEST, "Notification illisible"],
  BILLING_CURSOR_INVALID: [HttpStatus.BAD_REQUEST, "Curseur invalide"],
} as const satisfies Record<string, readonly [HttpStatus, string]>

export type BillingErrorCode = keyof typeof DEFINITIONS

export function billingError(
  code: BillingErrorCode,
  detail?: string,
): AppException {
  const [status, message] = DEFINITIONS[code]
  return new AppException(
    code,
    status,
    detail ? `${message} : ${detail}` : message,
  )
}
