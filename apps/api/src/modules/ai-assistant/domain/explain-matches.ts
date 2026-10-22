import type { SearchResultItem } from "@mon-appart/types"

import type {
  AssistantCriteria,
  AssistantListingCard,
} from "./assistant-criteria"

function locationLabel(item: SearchResultItem): string {
  const parts = [
    item.location.neighborhood.name,
    item.location.commune.name,
    item.location.city.name,
  ].filter(Boolean)
  return parts.join(", ")
}

/** Raisons fondées uniquement sur les champs de l’annonce + critères. */
export function matchReasons(
  item: SearchResultItem,
  criteria: AssistantCriteria,
): string[] {
  const reasons: string[] = []
  if (
    criteria.priceMax != null &&
    item.price &&
    item.price.amount <= criteria.priceMax
  ) {
    reasons.push("Dans votre budget maximum")
  }
  if (
    criteria.priceMin != null &&
    item.price &&
    item.price.amount >= criteria.priceMin
  ) {
    reasons.push("Au-dessus de votre budget minimum")
  }
  if (
    criteria.communes.length &&
    criteria.communes.includes(item.location.commune.code)
  ) {
    reasons.push(`Commune : ${item.location.commune.name}`)
  }
  if (
    criteria.neighborhoods.length &&
    criteria.neighborhoods.includes(item.location.neighborhood.code)
  ) {
    reasons.push(`Quartier : ${item.location.neighborhood.name}`)
  }
  if (
    criteria.propertyTypes.length &&
    criteria.propertyTypes.includes(item.propertyType.code)
  ) {
    reasons.push(`Type : ${item.propertyType.name}`)
  }
  if (
    criteria.listingTypes.length &&
    criteria.listingTypes.includes(item.listingType)
  ) {
    reasons.push(
      item.listingType === "RENT"
        ? "Location"
        : item.listingType === "SALE"
          ? "Vente"
          : "Opération demandée",
    )
  }
  if (
    criteria.bedroomsMin != null &&
    item.bedrooms != null &&
    item.bedrooms >= criteria.bedroomsMin
  ) {
    reasons.push(`Au moins ${criteria.bedroomsMin} chambre(s)`)
  }
  return reasons
}

export function toListingCards(
  items: SearchResultItem[],
  criteria: AssistantCriteria,
): AssistantListingCard[] {
  return items.map((item) => ({
    listingId: item.listingId,
    propertyId: item.propertyId,
    title: item.title,
    listingType: item.listingType,
    propertyType: item.propertyType,
    price: item.price,
    surface: item.surface,
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    locationLabel: locationLabel(item),
    mainImage: item.mainImage,
    matchReasons: matchReasons(item, criteria),
  }))
}

export function buildResultsMessage(
  count: number,
  criteria: AssistantCriteria,
): string {
  const bits: string[] = []
  if (criteria.listingTypes.includes("RENT")) bits.push("location")
  if (criteria.listingTypes.includes("SALE")) bits.push("achat")
  if (criteria.propertyTypes.length) {
    bits.push(criteria.propertyTypes.join(", ").toLowerCase())
  }
  if (criteria.communes.length) bits.push(criteria.communes.join(", "))
  else if (criteria.cities.length) bits.push(criteria.cities.join(", "))
  if (criteria.priceMax != null) {
    bits.push(`budget max ${criteria.priceMax.toLocaleString("fr-FR")} F CFA`)
  }

  const scope = bits.length ? ` (${bits.join(" · ")})` : ""
  if (count === 0) {
    return `Aucune annonce publiée ne correspond exactement à votre demande${scope}. Vous pouvez élargir le budget, changer de commune ou retirer un critère.`
  }
  const base = `${count} annonce${count > 1 ? "s" : ""} publiée${count > 1 ? "s" : ""} correspondent à vos critères${scope}.`
  const hints =
    criteria.unverifiableHints.length > 0
      ? ` ${criteria.unverifiableHints.join(" ")}`
      : ""
  return base + hints
}

export function emptySuggestions(criteria: AssistantCriteria): string[] {
  const ideas: string[] = []
  if (criteria.priceMax != null) {
    ideas.push(
      `Élargir le budget au-delà de ${criteria.priceMax.toLocaleString("fr-FR")} F CFA`,
    )
  }
  if (criteria.communes.length === 1) {
    ideas.push("Élargir à d’autres communes d’Abidjan")
  }
  if (criteria.bedroomsMin != null && criteria.bedroomsMin > 1) {
    ideas.push(`Accepter ${criteria.bedroomsMin - 1} chambre(s)`)
  }
  if (criteria.amenities.length) {
    ideas.push("Retirer un équipement non essentiel")
  }
  ideas.push("Lancer la recherche classique avec les filtres")
  return ideas.slice(0, 4)
}
