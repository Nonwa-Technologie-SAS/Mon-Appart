/** Utilitaires visite — plus de Prisma ; les RDV passent par Nest `/appointments`. */

export function normalizeWhatsapp(raw: string) {
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return null
  return digits
}
