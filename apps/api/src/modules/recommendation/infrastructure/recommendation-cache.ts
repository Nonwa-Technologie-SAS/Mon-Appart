import { Injectable } from "@nestjs/common"
import type {
  RecommendationContext,
  RecommendationLevel,
  RecommendationReasonCode,
} from "@mon-appart/types"

import { CacheService } from "../../../common/cache/cache.service"
import type { ScoreComponents } from "../domain/recommendation-input"
import { RecommendationConfig } from "../recommendation.config"

/** Liste classée complète (jusqu'à `maxResults`), paginée ensuite. */
export interface RankedList {
  asOf: string
  algorithmVersion: string
  level: RecommendationLevel
  degraded: boolean
  items: Array<{
    listingId: string
    propertyId: string
    publicId: string
    score: number
    reasons: RecommendationReasonCode[]
    components: ScoreComponents
  }>
}

const GENERATION_KEY = "rec:gen"
const LIST_PREFIX = "rec:list:v1"

/**
 * Cache des listes classées. Une liste personnalisée est rangée sous une clé
 * propre à l'utilisateur (identifiant public), jamais partagée ; les
 * visiteurs partagent les listes génériques. Invalidation par compteurs :
 * génération globale (annonces, prix) et version par utilisateur
 * (préférences, retours). Redis absent : chaque requête recalcule.
 */
@Injectable()
export class RecommendationCache {
  constructor(
    private readonly cache: CacheService,
    private readonly config: RecommendationConfig,
  ) {}

  async listKey(
    context: RecommendationContext,
    owner: string | null,
    hash: string,
  ): Promise<string> {
    const [generation, userVersion] = await Promise.all([
      this.cache.get(GENERATION_KEY),
      owner ? this.cache.get(userVersionKey(owner)) : Promise.resolve(null),
    ])
    return [
      LIST_PREFIX,
      context,
      owner ? `u:${owner}` : "guest",
      `g${generation ?? 0}`,
      `v${userVersion ?? 0}`,
      hash,
    ].join(":")
  }

  async get(key: string): Promise<RankedList | null> {
    if (this.config.cacheTtlSeconds <= 0) return null
    const raw = await this.cache.get(key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as RankedList
    } catch {
      return null
    }
  }

  async set(key: string, list: RankedList): Promise<void> {
    if (this.config.cacheTtlSeconds <= 0) return
    await this.cache.set(key, JSON.stringify(list), this.config.cacheTtlSeconds)
  }

  /** Annonce, prix ou bien modifié : toutes les listes deviennent obsolètes. */
  async bumpGeneration(): Promise<void> {
    await this.cache.incr(GENERATION_KEY)
  }

  /** Préférences ou retours de cet utilisateur : ses listes deviennent obsolètes. */
  async bumpUser(userPublicId: string): Promise<void> {
    await this.cache.incr(userVersionKey(userPublicId))
  }

  async markProfileDirty(userPublicId: string): Promise<void> {
    await this.cache.set(
      profileDirtyKey(userPublicId),
      "1",
      this.config.behavior.profileMaxAgeMinutes * 60,
    )
  }

  async isProfileDirty(userPublicId: string): Promise<boolean> {
    return (await this.cache.get(profileDirtyKey(userPublicId))) !== null
  }

  async clearProfileDirty(userPublicId: string): Promise<void> {
    await this.cache.del(profileDirtyKey(userPublicId))
  }
}

const userVersionKey = (owner: string) => `rec:user:${owner}:v`
const profileDirtyKey = (owner: string) => `rec:profile:dirty:${owner}`
