/**
 * Signaux de conversation : avertissement préventif, jamais une preuve.
 * Aucun corps de message n'est conservé ici ; seuls des codes stables sortent.
 */

export const MESSAGE_SAFETY_VERSION = "message-safety-v1"

export const MESSAGE_SAFETY_CODES = [
  "CREDENTIAL_HARVEST",
  "FAKE_SUPPORT",
  "PHISHING_LINK",
  "PAYMENT_PRESSURE",
  "OFF_PLATFORM",
] as const

export type MessageSafetyCode = (typeof MESSAGE_SAFETY_CODES)[number]
export type MessageSafetySeverity = "LOW" | "MEDIUM" | "HIGH"

export type MessageSafetyHint = {
  code: MessageSafetyCode
  severity: MessageSafetySeverity
  userMessage: string
}

const CREDENTIAL =
  /\b(otp|mot\s*de\s*passe|password|code\s*secret|code\s*de\s*confirmation|pin\s*(bancaire|secret))\b/i
const FAKE_SUPPORT =
  /\b(support|service\s*client|équipe)\s+(officiel(le)?\s+)?(de\s+)?mon[\s-]?appart\b|\bmon[\s-]?appart\s+(vous\s+demande|exige)\b/i
const SHORTENER = /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|cutt\.ly)\/\S+/i
const LOOKALIKE = /\bmon[-.]?app?art[-.]?(ci|com|net|org)\b/i
const PAYMENT_PRESSURE =
  /\b(acompte|frais\s+de\s+dossier|western\s+union|moneygram|paye[zr].{0,40}(imm[eé]diat|maintenant|urgent)|avant\s+(la\s+)?visite.{0,30}(payer|virement|orange\s+money|wave))\b/i
const OFF_PLATFORM =
  /\b(whatsapp|telegram|watsap|passe\s+sur\s+whats?app|on\s+se\s+parle\s+ailleurs)\b/i

const MESSAGES: Record<MessageSafetyCode, string> = {
  CREDENTIAL_HARVEST:
    "Ne communiquez jamais un code OTP, un mot de passe ou un PIN. Mon Appart ne les demande pas par message.",
  FAKE_SUPPORT:
    "Méfiez-vous des messages qui se présentent comme le support officiel. Vérifiez l’identité de votre interlocuteur dans la conversation.",
  PHISHING_LINK:
    "Ce message contient un lien à vérifier. N’ouvrez un lien que si vous en comprenez la destination.",
  PAYMENT_PRESSURE:
    "Méfiez-vous d’une demande de paiement urgente ou d’un acompte avant visite. Mon Appart ne garantit pas une transaction hors de ses parcours.",
  OFF_PLATFORM:
    "Un échange hors de la plateforme n’est pas couvert par les mêmes protections. Cela n’est pas forcément une fraude.",
}

export function scanMessageSafety(
  body: string | null | undefined,
): MessageSafetyHint[] {
  if (!body || body.trim().length === 0) return []
  const text = body.slice(0, 4000)
  const hints: MessageSafetyHint[] = []
  const add = (code: MessageSafetyCode, severity: MessageSafetySeverity) => {
    if (hints.some((item) => item.code === code)) return
    hints.push({ code, severity, userMessage: MESSAGES[code] })
  }
  if (CREDENTIAL.test(text)) add("CREDENTIAL_HARVEST", "HIGH")
  if (FAKE_SUPPORT.test(text) || LOOKALIKE.test(text))
    add("FAKE_SUPPORT", "HIGH")
  if (SHORTENER.test(text)) {
    add("PHISHING_LINK", PAYMENT_PRESSURE.test(text) ? "HIGH" : "MEDIUM")
  }
  if (PAYMENT_PRESSURE.test(text)) add("PAYMENT_PRESSURE", "MEDIUM")
  if (OFF_PLATFORM.test(text)) add("OFF_PLATFORM", "LOW")
  return hints
}

export function highestSafetySeverity(
  hints: readonly MessageSafetyHint[],
): MessageSafetySeverity | null {
  if (hints.some((item) => item.severity === "HIGH")) return "HIGH"
  if (hints.some((item) => item.severity === "MEDIUM")) return "MEDIUM"
  if (hints.length > 0) return "LOW"
  return null
}

export function trustRuleForHint(
  code: MessageSafetyCode,
): "MESSAGE_CREDENTIAL_HARVEST" | "MESSAGE_FAKE_SUPPORT" | null {
  if (code === "CREDENTIAL_HARVEST") return "MESSAGE_CREDENTIAL_HARVEST"
  if (code === "FAKE_SUPPORT") return "MESSAGE_FAKE_SUPPORT"
  return null
}
