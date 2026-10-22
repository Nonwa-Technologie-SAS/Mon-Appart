/** Requêtes par minute et par IP. */
export const interactionRateLimit = (): number =>
  Number(process.env.INTERACTION_RATE_LIMIT) || 60
