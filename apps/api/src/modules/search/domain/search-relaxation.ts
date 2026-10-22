import type {
  RelaxedFilterSuggestion,
  SearchZeroResults,
} from "@mon-appart/types"

import type { SearchQuery } from "./search-query"

/**
 * Propositions quand une recherche ne renvoie rien. Abstraction prévue pour
 * une implémentation plus fine plus tard ; aucune IA ici.
 */
export interface SearchRelaxationStrategy {
  suggest(query: SearchQuery): SearchZeroResults
}

/**
 * Règles simples, du plus précis au plus large. Rien n'est exécuté : le
 * client choisit d'appliquer ou non une proposition.
 */
export class RuleBasedRelaxationStrategy implements SearchRelaxationStrategy {
  constructor(private readonly maxRadiusKm: number) {}

  suggest(query: SearchQuery): SearchZeroResults {
    const relaxed: RelaxedFilterSuggestion[] = []
    if (query.neighborhoods.length > 0 && query.communes.length > 0) {
      relaxed.push({
        filter: "neighborhood",
        params: { neighborhood: null },
        label: "Élargir à toute la commune",
      })
    }
    if (query.geo) {
      const wider = Math.min(query.geo.radiusKm * 2, this.maxRadiusKm)
      if (wider > query.geo.radiusKm) {
        relaxed.push({
          filter: "radius",
          params: { radius: String(wider) },
          label: `Élargir le rayon à ${wider} km`,
        })
      }
    }
    if (query.price.max !== null) {
      const raised = Math.ceil((query.price.max * 1.2) / 1000) * 1000
      relaxed.push({
        filter: "maxPrice",
        params: { maxPrice: String(raised) },
        label: "Augmenter le budget de 20 %",
      })
    }
    if (query.amenities.length > 0) {
      relaxed.push({
        filter: "amenities",
        params: { amenities: null, amenitiesMode: null },
        label: "Retirer les équipements demandés",
      })
    }
    if (query.bedrooms.min !== null && query.bedrooms.min > 1) {
      relaxed.push({
        filter: "bedrooms",
        params: { bedrooms: String(query.bedrooms.min - 1) },
        label: `Au moins ${query.bedrooms.min - 1} chambre(s)`,
      })
    }
    if (query.propertyTypes.length > 0) {
      relaxed.push({
        filter: "propertyType",
        params: { propertyType: null },
        label: "Tous les types de biens",
      })
    }
    const suggestions = query.text
      ? ["Vérifiez l'orthographe", "Essayez des mots plus généraux"]
      : []
    return { suggestions, relaxedFilters: relaxed }
  }
}
