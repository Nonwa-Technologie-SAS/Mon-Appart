"use client"

import { formatDateTime } from "@/lib/format"
import { useResource } from "@/lib/use-api"

import {
  Badge,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Section,
} from "../ui"

type Risk = "low" | "moderate" | "high" | "critical"

type Overview = {
  generatedAt: string
  disclaimer: string
  systems: Array<{
    id: string
    name: string
    purpose: string
    technicalOwner: string
    productOwner: string
    kind: string
    status: string
    risk: Risk
    runtimeVersion: string
    runtimeEnabled: boolean
    disableConditions: string[]
  }>
  recommendation: {
    engine: string
    algorithmVersion: string
    shadowRemote: boolean
    remoteUrlConfigured: boolean
    uiFlag: boolean
    fallback: string
  }
  assistant: {
    enabled: boolean
    provider: string
    openaiReady: boolean
    promptVersion: string
    uiFlag: boolean
    fallback: string
  }
  cost: { estimated: null; note: string }
  incidents: { persisted: false; note: string }
}

type EvalReport = {
  dataset: { kind: string; version: string; note: string }
  k: number
  winner: string | null
  comparedToFreshness: {
    engine: string
    ndcgDelta: number
    precisionDelta: number
  } | null
  engines: Array<{
    name: string
    version: string
    emptyRate: number
    precisionAt5: number
    recallAt5: number
    ndcgAt5: number
    budgetViolationRate: number
    typeMatchRate: number
    ownerRedundancy: number
  }>
}

const RISK_BADGE: Record<Risk, string> = {
  low: "PASS",
  moderate: "WARN",
  high: "HIGH",
  critical: "CRITICAL",
}

function pct(value: number): string {
  return `${Math.round(value * 1000) / 10} %`
}

export function AiGovernanceView() {
  const overview = useResource<Overview>("/admin/ai/overview")
  const evalReport = useResource<EvalReport>("/admin/ai/eval")

  return (
    <>
      <PageHeader
        title="Gouvernance IA"
        description="Inventaire des systèmes réellement présents, versions runtime et évaluation hors ligne synthétique. Aucun KPI de production n’est inventé."
      />

      {overview.status === "loading" ? <Loading /> : null}
      {overview.status === "error" ? (
        <ErrorState error={overview.error} onRetry={overview.reload} />
      ) : null}

      {overview.status === "ready" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {overview.data.disclaimer}
          </p>
          <p className="text-xs text-muted-foreground">
            Généré le {formatDateTime(overview.data.generatedAt)}
          </p>

          <Section title="Portefeuille">
            {overview.data.systems.length === 0 ? (
              <EmptyState>Aucun système enregistré.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-3">Système</th>
                      <th className="py-2 pr-3">Statut</th>
                      <th className="py-2 pr-3">Risque</th>
                      <th className="py-2 pr-3">Version</th>
                      <th className="py-2">Propriétaire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.data.systems.map((system) => (
                      <tr key={system.id} className="border-b border-border/70">
                        <td className="py-2 pr-3">
                          <p className="font-medium">{system.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {system.purpose}
                          </p>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge
                            value={
                              system.runtimeEnabled ? "ACTIVE" : "SUSPENDED"
                            }
                            label={system.status}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Badge
                            value={RISK_BADGE[system.risk]}
                            label={system.risk}
                          />
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs">
                          {system.runtimeVersion}
                        </td>
                        <td className="py-2 text-xs">
                          {system.technicalOwner}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Moteur de recommandation">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Moteur servi</dt>
                <dd className="font-mono text-sm">
                  {overview.data.recommendation.engine} ·{" "}
                  {overview.data.recommendation.algorithmVersion}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Shadow remote</dt>
                <dd className="text-sm">
                  {overview.data.recommendation.shadowRemote
                    ? "activé (non servi)"
                    : "inactif"}
                  {overview.data.recommendation.remoteUrlConfigured
                    ? " · URL configurée"
                    : " · pas d’URL"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Flag UI</dt>
                <dd className="text-sm">
                  {overview.data.recommendation.uiFlag
                    ? "FF_WEB_RECOMMENDATIONS on"
                    : "UI masquée"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Rollback</dt>
                <dd className="text-sm">
                  {overview.data.recommendation.fallback}
                </dd>
              </div>
            </dl>
          </Section>

          <Section title="Assistant conversationnel">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Provider</dt>
                <dd className="font-mono text-sm">
                  {overview.data.assistant.provider}
                  {overview.data.assistant.openaiReady ? " (clé présente)" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Prompt</dt>
                <dd className="font-mono text-sm">
                  {overview.data.assistant.promptVersion}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Activation</dt>
                <dd className="text-sm">
                  API {overview.data.assistant.enabled ? "on" : "off"} · UI{" "}
                  {overview.data.assistant.uiFlag ? "on" : "off"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Repli</dt>
                <dd className="text-sm">{overview.data.assistant.fallback}</dd>
              </div>
            </dl>
          </Section>

          <Section title="Coûts et incidents">
            <p className="text-sm text-foreground">{overview.data.cost.note}</p>
            <p className="mt-2 text-sm text-foreground">
              {overview.data.incidents.note}
            </p>
          </Section>
        </div>
      ) : null}

      <div className="mt-6">
        <Section title="Évaluation hors ligne (synthétique)">
          {evalReport.status === "loading" ? <Loading /> : null}
          {evalReport.status === "error" ? (
            <ErrorState error={evalReport.error} onRetry={evalReport.reload} />
          ) : null}
          {evalReport.status === "ready" ? (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {evalReport.data.dataset.note} Version{" "}
                <span className="font-mono text-xs">
                  {evalReport.data.dataset.version}
                </span>
                . k={evalReport.data.k}.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-3">Moteur</th>
                      <th className="py-2 pr-3">P@5</th>
                      <th className="py-2 pr-3">R@5</th>
                      <th className="py-2 pr-3">NDCG@5</th>
                      <th className="py-2 pr-3">Hors budget</th>
                      <th className="py-2">Redondance proprio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evalReport.data.engines.map((engine) => (
                      <tr
                        key={engine.name}
                        className="border-b border-border/70"
                      >
                        <td className="py-2 pr-3 font-medium">
                          {engine.name}
                          {evalReport.data.winner === engine.name
                            ? " · meilleur NDCG"
                            : ""}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">
                          {pct(engine.precisionAt5)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">
                          {pct(engine.recallAt5)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">
                          {pct(engine.ndcgAt5)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">
                          {pct(engine.budgetViolationRate)}
                        </td>
                        <td className="py-2 tabular-nums">
                          {pct(engine.ownerRedundancy)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {evalReport.data.comparedToFreshness ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Delta NDCG vs fraîcheur :{" "}
                  {evalReport.data.comparedToFreshness.ndcgDelta.toFixed(3)} ·
                  delta P@5 :{" "}
                  {evalReport.data.comparedToFreshness.precisionDelta.toFixed(
                    3,
                  )}
                  . Un gain synthétique ne prouve pas une amélioration métier.
                </p>
              ) : null}
            </>
          ) : null}
        </Section>
      </div>
    </>
  )
}
