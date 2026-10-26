import { Logger } from "@nestjs/common"

import type { MetricsService } from "../../../observability/metrics.service"
import {
  RuleBasedRecommendationEngine,
  type RecommendationEngine,
} from "../domain/recommendation-engine"
import type {
  RankedRecommendation,
  RankingInput,
} from "../domain/recommendation-input"

export interface RankingResult {
  items: RankedRecommendation[]
  algorithmVersion: string
  /** Vrai si le moteur distant a échoué et que les règles ont répondu. */
  degraded: boolean
}

/**
 * Choisit le moteur. Les règles répondent toujours ; un moteur distant, s'il
 * est configuré, est essayé d'abord, borné par son délai, avec repli.
 */
export class RecommendationRanker {
  private readonly logger = new Logger(RecommendationRanker.name)
  private readonly rules = new RuleBasedRecommendationEngine()

  constructor(
    private readonly remote: RecommendationEngine | null,
    private readonly metrics: MetricsService,
    /** Classement distant comparé sans être servi. */
    private readonly shadow: RecommendationEngine | null = null,
  ) {}

  async rank(input: RankingInput): Promise<RankingResult> {
    if (this.remote) {
      try {
        return {
          items: await this.remote.rank(input),
          algorithmVersion: this.remote.version,
          degraded: false,
        }
      } catch (error) {
        const reason =
          error instanceof Error && error.name === "TimeoutError"
            ? "timeout"
            : "error"
        this.metrics.recommendation.fallbacks.inc({ reason })
        this.logger.warn(
          JSON.stringify({
            action: "recommendation_fallback",
            from: this.remote.name,
            to: this.rules.name,
            reason,
          }),
        )
        return {
          items: await this.rules.rank(input),
          algorithmVersion: this.rules.version,
          degraded: true,
        }
      }
    }
    const served = {
      items: await this.rules.rank(input),
      algorithmVersion: this.rules.version,
      degraded: false,
    }
    if (this.shadow) {
      void this.compareShadow(input, served.items)
    }
    return served
  }

  private async compareShadow(
    input: RankingInput,
    served: RankedRecommendation[],
  ): Promise<void> {
    if (!this.shadow) return
    try {
      const candidate = await this.shadow.rank(input)
      const servedTop = served
        .slice(0, 3)
        .map((item) => item.candidate.publicId)
        .join(",")
      const shadowTop = candidate
        .slice(0, 3)
        .map((item) => item.candidate.publicId)
        .join(",")
      const outcome = servedTop === shadowTop ? "agree" : "disagree"
      this.metrics.recommendation.shadow.inc({ outcome })
      this.logger.log(
        JSON.stringify({
          action: "recommendation_shadow",
          outcome,
          servedCount: served.length,
          shadowCount: candidate.length,
        }),
      )
    } catch {
      this.metrics.recommendation.shadow.inc({ outcome: "error" })
    }
  }
}
