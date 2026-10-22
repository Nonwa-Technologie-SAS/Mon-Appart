import { Injectable } from "@nestjs/common"

import type {
  AiTextProvider,
  ComposeReplyInput,
} from "./ai-provider"

/**
 * Fournisseur par défaut : reformulation déterministe, sans appel réseau.
 * Ne cite jamais d’annonce absente de `listings`.
 */
@Injectable()
export class RulesAiProvider implements AiTextProvider {
  readonly name = "rules" as const

  async composeReply(input: ComposeReplyInput): Promise<string> {
    if (input.mode === "clarify") return input.baseMessage

    const ids = new Set(input.listings.map((l) => l.listingId))
    let message = input.baseMessage.trim()

    if (input.listings.length > 0) {
      const titles = input.listings
        .slice(0, 3)
        .map((l) => `« ${l.title} »`)
        .join(", ")
      message += ` Exemples parmi les résultats : ${titles}.`
    }

    // Garde-fou : aucun UUID inventé dans le texte.
    const uuidRe =
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi
    for (const match of message.matchAll(uuidRe)) {
      if (!ids.has(match[0]!)) {
        message = message.replace(match[0]!, "[référence retirée]")
      }
    }

    return message
  }
}
