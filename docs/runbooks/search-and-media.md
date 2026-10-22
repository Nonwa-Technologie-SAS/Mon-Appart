# Runbook — Recherche et médias

## Recherche

Config : `SEARCH_ENGINE=postgres|opensearch`, `SEARCH_FALLBACK=postgres|none`.

```bash
curl -sS "$API/health/search"
curl -sS "$API/api/v1/search?limit=5"
pnpm --filter @mon-appart/api search:health
# Reindex (coûteux) — staging d’abord :
# pnpm --filter @mon-appart/api search:reindex
```

### Mode dégradé

- OpenSearch down + `SEARCH_FALLBACK=postgres` → recherche Postgres (latence/pertinence différentes).
- `SEARCH_FALLBACK=none` → erreurs search ; **ne pas** mettre ready API en down pour OpenSearch seul (déjà hors `/health/ready`).

### Hypothèses

Index obsolète, OS timeout, synonymes, saturation.

### Mitigation

Basculer `SEARCH_ENGINE=postgres` temporairement ; reindex hors pic ; vérifier `OPENSEARCH_NODE`.

## Médias

Stockage : local ou S3/R2 (`MEDIA_STORAGE`).

```bash
pnpm --filter @mon-appart/api media:orphans
# process / cleanup : CLI media (staging)
```

Hypothèses : credentials R2, bucket policy, CORS, disque local plein.

Mitigation : corriger secrets ; mode lecture seule annonces si upload KO ; ne pas supprimer objets en masse.

## Retour normal

Search 2xx, health/search cohérent, uploads smoke OK.
