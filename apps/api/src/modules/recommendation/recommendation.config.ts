import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import {
  DEFAULT_RECOMMENDATION_WEIGHTS,
  parseRecommendationWeights,
} from "@mon-appart/config"

import type {
  DiversityOptions,
  RecommendationWeights,
} from "./domain/recommendation-input"

/** Configuration Recommendation, lue une fois depuis l'environnement validé. */
@Injectable()
export class RecommendationConfig {
  readonly engine: "rules" | "remote"
  readonly remote: { url: string | null; timeoutMs: number }
  readonly limits: {
    defaultLimit: number
    maxLimit: number
    maxResults: number
  }
  readonly candidatePool: number
  readonly cacheTtlSeconds: number
  readonly ttlDays: number
  readonly behavior: {
    enabled: boolean
    lookbackDays: number
    halfLifeDays: number
    profileMaxAgeMinutes: number
  }
  readonly diversity: DiversityOptions
  readonly weights: RecommendationWeights
  /** Rayon maximal d'un point de préférence (aligné sur la recherche). */
  readonly maxRadiusKm: number
  /**
   * Appeler le moteur distant sans servir ses résultats
   * (uniquement si `engine === "rules"`).
   */
  readonly shadowRemote: boolean

  constructor(config: ConfigService) {
    const str = (key: string, fallback: string) => {
      const value = config.get<string | number>(key)
      return value === undefined || value === "" ? fallback : String(value)
    }
    const num = (key: string, fallback: number) => {
      const value = Number(config.get<string | number>(key) ?? fallback)
      return Number.isFinite(value) ? value : fallback
    }

    this.engine =
      str("RECOMMENDATION_ENGINE", "rules") === "remote" ? "remote" : "rules"
    const url = config.get<string>("RECOMMENDATION_SERVICE_URL")
    this.remote = {
      url: url ? url.replace(/\/+$/, "") : null,
      timeoutMs: num("RECOMMENDATION_SERVICE_TIMEOUT_MS", 800),
    }
    this.limits = {
      defaultLimit: num("RECOMMENDATION_DEFAULT_LIMIT", 20),
      maxLimit: Math.min(50, num("RECOMMENDATION_MAX_LIMIT", 50)),
      maxResults: num("RECOMMENDATION_MAX_RESULTS", 100),
    }
    this.candidatePool = num("RECOMMENDATION_CANDIDATE_POOL", 400)
    this.cacheTtlSeconds = num("RECOMMENDATION_CACHE_TTL_SECONDS", 300)
    this.ttlDays = num("RECOMMENDATION_TTL_DAYS", 7)
    this.behavior = {
      enabled: str("RECOMMENDATION_ENABLE_BEHAVIOR_SIGNALS", "true") === "true",
      lookbackDays: num("RECOMMENDATION_BEHAVIOR_LOOKBACK_DAYS", 90),
      halfLifeDays: num("RECOMMENDATION_BEHAVIOR_HALF_LIFE_DAYS", 30),
      profileMaxAgeMinutes: num("RECOMMENDATION_PROFILE_MAX_AGE_MINUTES", 60),
    }
    this.diversity = {
      enabled: str("RECOMMENDATION_ENABLE_DIVERSIFICATION", "true") === "true",
      lambda: num("RECOMMENDATION_DIVERSITY", 0.3),
      maxPerOwner: num("RECOMMENDATION_MAX_PER_OWNER", 2),
    }
    this.weights = parseRecommendationWeights(
      str("RECOMMENDATION_WEIGHTS", DEFAULT_RECOMMENDATION_WEIGHTS),
    )
    this.maxRadiusKm = num("SEARCH_MAX_RADIUS_KM", 50)
    this.shadowRemote =
      str("RECOMMENDATION_SHADOW", "false") === "true" &&
      this.engine === "rules"
  }
}

/**
 * Limites par minute et par IP, lues au moment de la requête par le
 * ThrottlerGuard (l'environnement est validé au démarrage).
 */
export const recommendationRateLimit = (): number =>
  Number(process.env.RECOMMENDATION_RATE_LIMIT) || 60
export const feedbackRateLimit = (): number =>
  Number(process.env.RECOMMENDATION_FEEDBACK_RATE_LIMIT) || 120
