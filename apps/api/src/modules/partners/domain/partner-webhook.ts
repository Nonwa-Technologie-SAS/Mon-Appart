/**
 * Signature outbound partenaires — même format que le billing :
 * en-tête `Mon-Appart-Signature: t=<unix>,v1=<hex>` sur `<t>.<corps>`.
 */
export {
  signPayload,
  verifySignature,
  sha256Hex,
  type SignatureCheck,
} from "../../billing/domain/webhook-signature"

export const PARTNER_SIGNATURE_HEADER = "mon-appart-signature"
