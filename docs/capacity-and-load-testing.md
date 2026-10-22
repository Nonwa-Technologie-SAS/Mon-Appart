# Capacité et tests de charge

## Parcours prioritaires

1. `GET /health/live` + `GET /api/v1/meta`
2. `GET /api/v1/search`
3. Fiche listing
4. Auth login (staging, comptes synthétiques)
5. Publish (éditeur) — volume bas
6. Upload média — isolement
7. Workers / files

## Outil

[k6](https://k6.io) — scripts dans `scripts/load/` :

```bash
# Smoke 5 VU / 30s
k6 run -e BASE_URL=http://127.0.0.1:4000 scripts/load/k6-smoke.js

# Ramp 10→30 VU
k6 run -e BASE_URL=http://127.0.0.1:4000 scripts/load/k6-ramp.js
```

## Seuils scripts (proposés)

- `http_req_failed` < 2–5 %
- p95 < 1,5–2 s selon scénario

## Résultats

| Scénario | Exécuté | Résultat |
| --- | --- | --- |
| k6-smoke | **Non** (k6 / API non garantis dans cette session) | Prérequis : installer k6 + API up |
| k6-ramp | Non | Staging isolé recommandé |
| Prod | **Interdit** sans approbation | — |

## Goulots attendus (hypothèses)

- Pool PG (≈10 connexions/instance) → PgBouncer au scale.
- Redis single node.
- Uploads / sharp CPU.
- Search full-text sans OpenSearch sous charge lecture.

Mesurer avant d’acheter OpenSearch ou K8s.
