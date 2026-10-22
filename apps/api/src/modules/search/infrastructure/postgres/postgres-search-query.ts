import type { SearchSort } from "@mon-appart/types"

import { Prisma } from "../../../../generated/prisma/client"
import { nearCondition, publishedPointSql } from "../../../property"
import {
  activeWeights,
  FRESHNESS_HALF_LIFE_DAYS,
  TS_RANK_WEIGHTS,
} from "../../domain/search-ranking"
import type { ResolvedSearch } from "../../domain/search-engine"
import type { SearchText } from "../../domain/search-query"
import { buildTsQuery, type SynonymMap } from "../../domain/text-normalizer"

const TS_CONFIG = Prisma.sql`'public.mon_appart_fr'::regconfig`
const RANK_WEIGHTS = Prisma.raw(`'{${TS_RANK_WEIGHTS.join(",")}}'::float4[]`)
/** Sentinelles : les annonces sans prix ou sans surface passent en dernier. */
const HIGH = Prisma.raw("999999999999999")
const LOW = Prisma.raw("-1")

interface SortSpec {
  expression: Prisma.Sql
  type: Prisma.Sql
  descending: boolean
}

/**
 * Construit le SQL de recherche publique. Toute valeur issue de la requête
 * passe en paramètre lié (`Prisma.sql`) ; seuls des fragments constants sont
 * insérés en brut. Jamais de `$queryRawUnsafe`.
 */
export class PostgresSearchQueryBuilder {
  constructor(private readonly synonyms: SynonymMap) {}

  /** Annonces publiables : la projection n'est jamais crue sur le statut. */
  from(request: ResolvedSearch): Prisma.Sql {
    const documentJoin = request.query.text
      ? Prisma.sql`JOIN listing_search_documents d ON d.listing_id = l.id`
      : Prisma.sql`LEFT JOIN listing_search_documents d ON d.listing_id = l.id`
    return Prisma.sql`FROM listings l
      JOIN properties p ON p.id = l.property_id
      LEFT JOIN listing_prices lp ON lp.listing_id = l.id AND lp.valid_to IS NULL
      ${documentJoin}`
  }

  /** Règles de visibilité publique, partagées avec les recommandations (alias `l`, `p`). */
  publicConditions(): Prisma.Sql[] {
    return [
      Prisma.sql`l.status = 'PUBLISHED'`,
      Prisma.sql`l.deleted_at IS NULL`,
      Prisma.sql`(l.expires_at IS NULL OR l.expires_at > now())`,
      Prisma.sql`p.status = 'ACTIVE'`,
      Prisma.sql`p.deleted_at IS NULL`,
    ]
  }

  /** Fraîcheur 0..1 depuis `published_at`, décroissance hyperbolique. */
  freshness(asOf: Date): Prisma.Sql {
    return Prisma.sql`(1.0 / (1.0 + GREATEST(0, EXTRACT(EPOCH FROM (${asOf}::timestamptz - l.published_at)) / 86400.0) / ${FRESHNESS_HALF_LIFE_DAYS}::float8))`
  }

  /** `null` si aucun résultat n'est possible (lieu inconnu de l'index, etc.). */
  where(request: ResolvedSearch): Prisma.Sql | null {
    const { query } = request
    const conditions = this.publicConditions()

    const text = this.textCondition(request)
    if (text) conditions.push(text)

    if (query.listingTypes.length > 0) {
      conditions.push(
        Prisma.sql`l.listing_type IN (${Prisma.join(query.listingTypes.map((type) => Prisma.sql`${type}::listing_type`))})`,
      )
    }
    if (request.propertyTypeIds.length > 0) {
      conditions.push(
        Prisma.sql`p.property_type_id IN (${Prisma.join(request.propertyTypeIds)})`,
      )
    }
    if (request.neighborhoodIds) {
      if (request.neighborhoodIds.length === 0) return null
      conditions.push(
        Prisma.sql`p.neighborhood_id IN (${Prisma.join(request.neighborhoodIds)})`,
      )
    }
    if (query.price.min !== null) {
      conditions.push(Prisma.sql`lp.amount >= ${query.price.min}`)
    }
    if (query.price.max !== null) {
      conditions.push(Prisma.sql`lp.amount <= ${query.price.max}`)
    }
    // Surface utile, ou surface du terrain pour un terrain nu.
    if (query.surface.min !== null) {
      conditions.push(
        Prisma.sql`COALESCE(p.surface, p.land_surface) >= ${query.surface.min}`,
      )
    }
    if (query.surface.max !== null) {
      conditions.push(
        Prisma.sql`COALESCE(p.surface, p.land_surface) <= ${query.surface.max}`,
      )
    }
    if (query.landSurface.min !== null) {
      conditions.push(Prisma.sql`p.land_surface >= ${query.landSurface.min}`)
    }
    if (query.landSurface.max !== null) {
      conditions.push(Prisma.sql`p.land_surface <= ${query.landSurface.max}`)
    }
    if (query.bedrooms.min !== null) {
      conditions.push(Prisma.sql`p.bedrooms >= ${query.bedrooms.min}`)
    }
    if (query.bedrooms.max !== null) {
      conditions.push(Prisma.sql`p.bedrooms <= ${query.bedrooms.max}`)
    }
    if (query.bathrooms.min !== null) {
      conditions.push(Prisma.sql`p.bathrooms >= ${query.bathrooms.min}`)
    }
    if (request.amenityIds.length > 0) {
      const ids = Prisma.join(request.amenityIds)
      conditions.push(
        query.amenitiesMode === "AND"
          ? Prisma.sql`(SELECT count(*) FROM property_amenities pa
              WHERE pa.property_id = p.id AND pa.amenity_id IN (${ids})) = ${request.amenityIds.length}`
          : Prisma.sql`EXISTS (SELECT 1 FROM property_amenities pa
              WHERE pa.property_id = p.id AND pa.amenity_id IN (${ids}))`,
      )
    }
    if (query.geo) {
      conditions.push(
        nearCondition(
          {
            latitude: query.geo.latitude,
            longitude: query.geo.longitude,
            radiusMeters: query.geo.radiusKm * 1000,
          },
          true,
        ),
      )
    }
    return Prisma.join(conditions, " AND ")
  }

  /** Condition de pagination par tuple (valeur de tri, id). */
  keyset(request: ResolvedSearch): Prisma.Sql | null {
    const cursor = request.cursor
    if (!cursor || cursor.key === null) return null
    const sort = this.sort(request)
    const cursorId = Prisma.sql`(SELECT c.id FROM listings c WHERE c.public_id = ${cursor.id}::uuid)`
    const value = Prisma.sql`${cursor.key}::${sort.type}`
    return sort.descending
      ? Prisma.sql`(${sort.expression}, l.id) < (${value}, ${cursorId})`
      : Prisma.sql`(${sort.expression}, l.id) > (${value}, ${cursorId})`
  }

  orderBy(request: ResolvedSearch): Prisma.Sql {
    const sort = this.sort(request)
    const direction = Prisma.raw(sort.descending ? "DESC" : "ASC")
    return Prisma.sql`ORDER BY ${sort.expression} ${direction}, l.id ${direction}`
  }

  sortKey(request: ResolvedSearch): Prisma.Sql {
    return Prisma.sql`(${this.sort(request).expression})::text`
  }

  /** Distance en mètres depuis la position publiée (jamais la position réelle). */
  distance(request: ResolvedSearch): Prisma.Sql | null {
    const geo = request.query.geo
    if (!geo) return null
    return Prisma.sql`ST_Distance(${publishedPointSql("p")}, ${this.origin(request)})`
  }

  /** Score 0..1, voir `search-ranking.ts`. */
  score(request: ResolvedSearch): Prisma.Sql {
    const { query } = request
    const weights = activeWeights({
      text: query.text !== null,
      location: query.geo !== null,
    })
    const parts: Prisma.Sql[] = []
    if (query.text) {
      parts.push(
        Prisma.sql`${weights.text}::float8 * ${this.textScore(request)}`,
      )
    }
    if (query.geo) {
      parts.push(
        Prisma.sql`${weights.location}::float8 * GREATEST(0, 1 - ${this.distance(request)} / ${query.geo.radiusKm * 1000}::float8)`,
      )
    }
    parts.push(
      Prisma.sql`${weights.freshness}::float8 * ${this.freshness(request.asOf)}`,
      Prisma.sql`${weights.quality}::float8 * COALESCE(d.quality_score, 0)`,
    )
    return Prisma.sql`(${Prisma.join(parts, " + ")})::float8`
  }

  private sort(request: ResolvedSearch): SortSpec {
    const sort: SearchSort = request.query.sort
    switch (sort) {
      case "RELEVANCE":
        return {
          expression: this.score(request),
          type: Prisma.raw("float8"),
          descending: true,
        }
      case "NEWEST":
        return {
          expression: Prisma.sql`l.published_at`,
          type: Prisma.raw("timestamptz"),
          descending: true,
        }
      case "PRICE_ASC":
        return {
          expression: Prisma.sql`COALESCE(lp.amount, ${HIGH})`,
          type: Prisma.raw("numeric"),
          descending: false,
        }
      case "PRICE_DESC":
        return {
          expression: Prisma.sql`COALESCE(lp.amount, ${LOW})`,
          type: Prisma.raw("numeric"),
          descending: true,
        }
      case "SURFACE_ASC":
        return {
          expression: Prisma.sql`COALESCE(p.surface, p.land_surface, ${HIGH})`,
          type: Prisma.raw("numeric"),
          descending: false,
        }
      case "SURFACE_DESC":
        return {
          expression: Prisma.sql`COALESCE(p.surface, p.land_surface, ${LOW})`,
          type: Prisma.raw("numeric"),
          descending: true,
        }
      case "DISTANCE":
        return {
          expression: Prisma.sql`COALESCE(${this.distance(request)}, ${HIGH})`,
          type: Prisma.raw("float8"),
          descending: false,
        }
    }
  }

  private origin(request: ResolvedSearch): Prisma.Sql {
    const geo = request.query.geo!
    return Prisma.sql`ST_SetSRID(ST_MakePoint(${geo.longitude}::float8, ${geo.latitude}::float8), 4326)::geography`
  }

  private tsQuery(request: ResolvedSearch): Prisma.Sql | null {
    const text = request.query.text
    if (!text) return null
    const expression = buildTsQuery(text.tokens, this.synonyms)
    return expression
      ? Prisma.sql`to_tsquery(${TS_CONFIG}, ${expression})`
      : null
  }

  private textCondition(request: ResolvedSearch): Prisma.Sql | null {
    const text = request.query.text
    if (!text) return null
    if (request.fuzzy) {
      // Mot à mot : la similarité d'une phrase entière chute dès que les mots
      // ne sont pas contigus dans le document (« apartement marcori »).
      const words = fuzzyWords(text)
      return Prisma.sql`(${Prisma.join(
        words.map((word) => Prisma.sql`d.suggest_text %> ${word}`),
        " AND ",
      )})`
    }
    const tsq = this.tsQuery(request)!
    // Requête réduite à des mots vides (« de la ») : aucun filtre texte.
    return Prisma.sql`(numnode(${tsq}) = 0 OR d.search_vector @@ ${tsq})`
  }

  private textScore(request: ResolvedSearch): Prisma.Sql {
    const text = request.query.text!
    if (request.fuzzy) {
      const words = fuzzyWords(text)
      return Prisma.sql`((${Prisma.join(
        words.map(
          (word) => Prisma.sql`word_similarity(${word}, d.suggest_text)`,
        ),
        " + ",
      )}) / ${words.length}::float8)`
    }
    return Prisma.sql`ts_rank_cd(${RANK_WEIGHTS}, d.search_vector, ${this.tsQuery(request)!}, 32)::float8`
  }
}

/** Mots comparés en mode tolérant : trop courts, ils n'ont pas assez de trigrammes. */
function fuzzyWords(text: SearchText): string[] {
  const long = text.tokens.filter((token) => token.length >= 3)
  if (long.length > 0) return long
  return text.tokens.length > 0 ? text.tokens : [text.normalized]
}
