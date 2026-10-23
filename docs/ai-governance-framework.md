# Cadre de gouvernance IA — Mon Appart

Ce cadre décrit comment les fonctionnalités « intelligentes » sont inventoriées, versionnées, évaluées et désactivées. Ce n’est **pas** une certification juridique.

## Principes

- Une fonctionnalité n’est pas intelligente parce qu’elle appelle un LLM.
- Seuls les systèmes **présents dans le code** figurent à l’inventaire opérationnel.
- PostgreSQL reste la source de vérité métier ; Prometheus pour les métriques techniques ; le catalogue Analytics pour les événements (sans PII).
- Pas de second moteur de recommandation, pas de warehouse ML parallèle.

## Composants

| Besoin                     | Implémentation réelle                                                     |
| -------------------------- | ------------------------------------------------------------------------- |
| Registre des systèmes      | `apps/api/src/modules/ai-governance/domain/ai-system-registry.ts`         |
| Évaluation reco hors ligne | `offline-eval.ts` + métriques `evaluation-metrics.ts`                     |
| Versions reco              | `rules-v1` / `remote-v1` persistées sur `Recommendation.algorithmVersion` |
| Versions prompt            | `assistant-reply-v1`                                                      |
| Shadow                     | `RECOMMENDATION_SHADOW=true` (engine=rules)                               |
| Dashboard                  | Admin `/ai` (`ai:admin`)                                                  |
| Rollback                   | `RECOMMENDATION_ENGINE=rules`, `AI_ASSISTANT_PROVIDER=rules`, flags UI    |

## Documents

- Inventaire : `ai-system-inventory.md`
- Risques : `ai-risk-classification.md`
- Reco : `recommendation-engine-evaluation.md`, `docs/recommendation.md`
- LLM : `llm-evaluation-and-prompt-governance.md`
- Responsabilité : `ai-responsible-use-and-bias.md`
- Données : `ai-data-governance.md`
- Observabilité : `ai-observability-and-monitoring.md`
- Déploiement : `model-versioning-and-deployment.md`
- Incidents : `ai-incident-response.md`
- Sécurité : `ai-security-and-prompt-injection.md` (complète `ai-security-and-privacy.md`)
- Coûts : `ai-cost-monitoring.md`
- Tests : `ai-testing-strategy.md`
- Exploitation : `ai-operations-runbook.md`
