import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { resolveFeatureFlags } from "@mon-appart/config"

import { AiAssistantConfig } from "../../ai-assistant/ai-assistant.config"
import { ASSISTANT_REPLY_PROMPT_VERSION } from "../../ai-assistant/domain/prompt-governance"
import { RULES_ENGINE_VERSION } from "../../recommendation/domain/recommendation-engine"
import { REMOTE_ENGINE_VERSION } from "../../recommendation/infrastructure/remote-recommendation.engine"
import { RecommendationConfig } from "../../recommendation/recommendation.config"
import {
  AI_SYSTEM_REGISTRY,
  type AiSystemRecord,
} from "../domain/ai-system-registry"
import {
  evaluateRecommendationOffline,
  type OfflineEvalReport,
} from "../domain/offline-eval"

export interface AiGovernanceOverview {
  generatedAt: string
  disclaimer: string
  systems: Array<
    AiSystemRecord & {
      runtimeVersion: string
      runtimeEnabled: boolean
    }
  >
  recommendation: {
    engine: "rules" | "remote"
    algorithmVersion: string
    shadowRemote: boolean
    remoteUrlConfigured: boolean
    uiFlag: boolean
    fallback: string
  }
  assistant: {
    enabled: boolean
    provider: "rules" | "openai"
    openaiReady: boolean
    promptVersion: string
    uiFlag: boolean
    fallback: string
  }
  cost: {
    estimated: null
    note: string
  }
  incidents: {
    persisted: false
    note: string
  }
}

@Injectable()
export class AiGovernanceService {
  constructor(
    private readonly config: ConfigService,
    private readonly recommendation: RecommendationConfig,
    private readonly assistant: AiAssistantConfig,
  ) {}

  overview(): AiGovernanceOverview {
    const flags = resolveFeatureFlags({
      SEARCH_ENGINE: this.config.get<string>("SEARCH_ENGINE"),
      RECOMMENDATION_ENGINE: this.config.get<string>("RECOMMENDATION_ENGINE"),
      RECOMMENDATION_SHADOW: this.config.get<string>("RECOMMENDATION_SHADOW"),
      FF_WEB_ASSISTANT: this.config.get<string>("FF_WEB_ASSISTANT"),
      FF_WEB_RECOMMENDATIONS: this.config.get<string>("FF_WEB_RECOMMENDATIONS"),
      METRICS_ENABLED: this.config.get<string>("METRICS_ENABLED"),
      APP_ENV: this.config.get<string>("APP_ENV"),
    })

    const algorithmVersion =
      this.recommendation.engine === "remote" && this.recommendation.remote.url
        ? REMOTE_ENGINE_VERSION
        : RULES_ENGINE_VERSION

    return {
      generatedAt: new Date().toISOString(),
      disclaimer:
        "Inventaire des systèmes réellement présents. Aucun KPI de production n’est inventé.",
      systems: AI_SYSTEM_REGISTRY.map((system) =>
        this.withRuntime(system, flags, algorithmVersion),
      ),
      recommendation: {
        engine: this.recommendation.engine,
        algorithmVersion,
        shadowRemote: this.recommendation.shadowRemote,
        remoteUrlConfigured: Boolean(this.recommendation.remote.url),
        uiFlag: flags.web_recommendations,
        fallback: "rules-v1",
      },
      assistant: {
        enabled: this.assistant.enabled,
        provider: this.assistant.provider,
        openaiReady: this.assistant.openaiReady,
        promptVersion: ASSISTANT_REPLY_PROMPT_VERSION,
        uiFlag: flags.web_assistant,
        fallback: "rules + Search",
      },
      cost: {
        estimated: null,
        note: "Aucun coût fournisseur n’est collecté. Compteurs Prometheus assistant_* et recommendation_* uniquement.",
      },
      incidents: {
        persisted: false,
        note: "Procédures dans docs/ai-incident-response.md ; suivi via Sentry / logs.",
      },
    }
  }

  evaluateRecommendations(): OfflineEvalReport {
    return evaluateRecommendationOffline()
  }

  private withRuntime(
    system: AiSystemRecord,
    flags: ReturnType<typeof resolveFeatureFlags>,
    algorithmVersion: string,
  ): AiSystemRecord & { runtimeVersion: string; runtimeEnabled: boolean } {
    if (system.id === "recommendation") {
      return {
        ...system,
        runtimeVersion: algorithmVersion,
        runtimeEnabled: flags.web_recommendations,
        configOrModelVersion: algorithmVersion,
      }
    }
    if (system.id === "assistant") {
      return {
        ...system,
        runtimeVersion: ASSISTANT_REPLY_PROMPT_VERSION,
        runtimeEnabled: this.assistant.enabled && flags.web_assistant,
        configOrModelVersion: ASSISTANT_REPLY_PROMPT_VERSION,
      }
    }
    if (system.id === "remote_ranker") {
      return {
        ...system,
        runtimeVersion: REMOTE_ENGINE_VERSION,
        runtimeEnabled:
          this.recommendation.engine === "remote" &&
          Boolean(this.recommendation.remote.url),
      }
    }
    return {
      ...system,
      runtimeVersion: system.configOrModelVersion,
      runtimeEnabled: system.status === "operational",
    }
  }
}
