import { Injectable } from "@nestjs/common"

import { DatabaseService } from "../../../../database/database.service"
import type { ListingSearchDocument } from "../../domain/listing-search-document"

/**
 * Écriture de la projection `listing_search_documents`. Upsert idempotent :
 * rejouer un événement produit le même état.
 */
@Injectable()
export class PostgresIndexStore {
  constructor(private readonly db: DatabaseService) {}

  /** INSERT … ON CONFLICT : atomique même si deux événements se croisent. */
  async upsert(
    listingId: bigint,
    document: ListingSearchDocument,
  ): Promise<void> {
    const location = [
      document.location.neighborhoodName,
      document.location.communeName,
      document.location.cityName,
    ].join(" ")
    const amenities = document.amenities
      .map((amenity) => amenity.name)
      .join(" ")
    await this.db.client.$executeRaw`
      INSERT INTO listing_search_documents (
        listing_id, schema_version, title_text, type_text, location_text,
        description_text, amenities_text, quality_score, indexed_at
      ) VALUES (
        ${listingId}, ${document.schemaVersion}, ${document.title},
        ${document.propertyType.name}, ${location},
        ${document.description.slice(0, 10_000)}, ${amenities},
        ${document.qualityScore}, now()
      )
      ON CONFLICT (listing_id) DO UPDATE SET
        schema_version = EXCLUDED.schema_version,
        title_text = EXCLUDED.title_text,
        type_text = EXCLUDED.type_text,
        location_text = EXCLUDED.location_text,
        description_text = EXCLUDED.description_text,
        amenities_text = EXCLUDED.amenities_text,
        quality_score = EXCLUDED.quality_score,
        indexed_at = EXCLUDED.indexed_at
    `
  }

  async deleteByPublicId(publicId: string): Promise<void> {
    await this.db.client.listingSearchDocument.deleteMany({
      where: { listing: { publicId } },
    })
  }

  /** Documents d'annonces supprimées ou de biens supprimés. */
  async deleteOrphans(): Promise<number> {
    const result = await this.db.client.listingSearchDocument.deleteMany({
      where: {
        OR: [
          { listing: { deletedAt: { not: null } } },
          { listing: { property: { deletedAt: { not: null } } } },
        ],
      },
    })
    return result.count
  }

  count(): Promise<number> {
    return this.db.client.listingSearchDocument.count()
  }
}
