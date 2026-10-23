# Stratégie de tests IA

## Reco

- `recommendation-domain.spec.ts` : budget, raisons, poids
- `recommendation-ranker.spec.ts` : remote, fallback, **shadow**
- `evaluation-metrics.spec.ts` : P@K, R@K, NDCG, AP
- `offline-eval.spec.ts` : hors budget exclu, MMR, dataset synthétique
- `ai-system-registry.spec.ts` : inventaire, pas de risque critique auto

## Assistant

- `criteria-extractor.spec.ts`
- `eval-dataset.spec.ts` (golden synthétique)
- `output-sanitize.spec.ts` (UUID, injection, PII)
- `prompt-governance.spec.ts`
- `assistant.service.spec.ts` : Search, isolation, degraded

## Gouvernance

- permission admin `ai:admin` (seed + nav)
- catalogue Analytics : nouveaux événements `assistant_*`

Commandes :

```bash
pnpm --filter api exec vitest run src/modules/ai-governance src/modules/ai-assistant src/modules/recommendation
pnpm --filter @mon-appart/analytics exec vitest run
pnpm --filter @mon-appart/config exec vitest run src/feature-flags.test.ts
pnpm --filter admin exec vitest run lib/permissions.test.ts
```
