import { Injectable } from "@nestjs/common"

import { CacheService } from "../../../common/cache/cache.service"
import { OnEvents } from "../../../common/events/on-events.decorator"
import { ListingEvent } from "../../listing"
import {
  BADGE_DISCLAIMER,
  listingBadges,
  userBadges,
  type Badge,
} from "../domain/badges"
import { trustError } from "../domain/trust-errors"
import { TrustEvent } from "../domain/trust-events"
import { TrustRepository } from "../infrastructure/trust.repository"

export interface UserBadgesView {
  userId: string
  badges: Badge[]
  disclaimer: string
}

export interface ListingBadgesView {
  listingId: string
  /** Faits sur l'annonce et le bien (droit de publication, documents, contrôle). */
  badges: Badge[]
  /** Faits sur le compte qui a créé l'annonce (téléphone, identité...). */
  publisherBadges: Badge[]
  /** Un dossier est en cours d'examen : information, pas un badge. */
  verificationInProgress: boolean
  disclaimer: string
}

const GENERATION_KEY = "trust:badges:gen"
const TTL_SECONDS = 300

/**
 * Badges publics. Aucun badge sans vérification approuvée et valide : une
 * pièce téléversée, un dossier en cours ou rejeté n'en donnent pas. Le
 * cache est invalidé par compteur de génération et borné à 5 minutes.
 */
@Injectable()
export class BadgeService {
  constructor(
    private readonly trust: TrustRepository,
    private readonly cache: CacheService,
  ) {}

  async forUser(publicId: string): Promise<UserBadgesView> {
    const user = await this.trust.client.user.findFirst({
      // Un compte PENDING peut déjà publier ; suspendu, banni ou fermé : introuvable.
      where: {
        publicId,
        deletedAt: null,
        status: { in: ["ACTIVE", "PENDING"] },
      },
      select: {
        id: true,
        publicId: true,
        phoneVerifiedAt: true,
        emailVerifiedAt: true,
      },
    })
    if (!user) throw trustError("USER_NOT_FOUND")
    return this.cached(`user:${user.publicId}`, async () => ({
      userId: user.publicId,
      badges: await this.userBadgesOf(user),
      disclaimer: BADGE_DISCLAIMER,
    }))
  }

  /** Annonce publiée uniquement : sinon introuvable (rien ne fuit). */
  async forListing(publicId: string): Promise<ListingBadgesView> {
    const listing = await this.trust.client.listing.findFirst({
      where: {
        publicId,
        deletedAt: null,
        status: "PUBLISHED",
        property: { deletedAt: null, status: "ACTIVE" },
      },
      select: {
        id: true,
        publicId: true,
        propertyId: true,
        createdBy: {
          select: {
            id: true,
            phoneVerifiedAt: true,
            emailVerifiedAt: true,
          },
        },
        prices: {
          where: { validTo: null },
          select: { validFrom: true },
          take: 1,
        },
      },
    })
    if (!listing) throw trustError("LISTING_NOT_FOUND")
    return this.cached(`listing:${listing.publicId}`, async () => {
      const [verifications, relations, open, publisherBadges] =
        await Promise.all([
          this.trust.propertyFacts(listing.propertyId),
          this.trust.currentRelations(listing.propertyId),
          this.trust.countOpenOnProperty(listing.propertyId, listing.id),
          this.userBadgesOf(listing.createdBy),
        ])
      return {
        listingId: listing.publicId,
        badges: listingBadges(
          {
            listingId: listing.id,
            propertyId: listing.propertyId,
            currentPriceSince: listing.prices[0]?.validFrom ?? null,
            verifications,
            relations,
          },
          new Date(),
        ),
        publisherBadges,
        verificationInProgress: open > 0,
        disclaimer: BADGE_DISCLAIMER,
      }
    })
  }

  /** Toute décision, tout prix modifié : les badges en cache sont périmés. */
  @OnEvents([TrustEvent.TRUST_CHANGED, ListingEvent.PRICE_CHANGED], {
    async: true,
    promisify: true,
    suppressErrors: true,
  })
  async invalidate(): Promise<void> {
    await this.cache.incr(GENERATION_KEY)
  }

  private async userBadgesOf(user: {
    id: bigint
    phoneVerifiedAt: Date | null
    emailVerifiedAt: Date | null
  }): Promise<Badge[]> {
    return userBadges(
      {
        phoneVerifiedAt: user.phoneVerifiedAt,
        emailVerifiedAt: user.emailVerifiedAt,
        verifications: await this.trust.userFacts(user.id),
      },
      new Date(),
    )
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const generation = (await this.cache.get(GENERATION_KEY)) ?? "0"
    const fullKey = `trust:badges:${generation}:${key}`
    const hit = await this.cache.get(fullKey)
    if (hit) {
      try {
        return JSON.parse(hit, reviveDates) as T
      } catch {
        // Entrée illisible : on recalcule.
      }
    }
    const value = await load()
    await this.cache.set(fullKey, JSON.stringify(value), TTL_SECONDS)
    return value
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === "string" && ISO_DATE.test(value)
    ? new Date(value)
    : value
}
