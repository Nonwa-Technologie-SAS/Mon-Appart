# Runbook opérations IA

## Activer / couper

| Action                                | Variable                                                    |
| ------------------------------------- | ----------------------------------------------------------- |
| Masquer reco UI                       | `FF_WEB_RECOMMENDATIONS=false`                              |
| Masquer assistant UI                  | `FF_WEB_ASSISTANT=false`                                    |
| Couper API assistant                  | `AI_ASSISTANT_ENABLED=false`                                |
| Reformulation LLM off                 | `AI_ASSISTANT_PROVIDER=rules`                               |
| Reco = règles                         | `RECOMMENDATION_ENGINE=rules`                               |
| Shadow remote                         | `RECOMMENDATION_SHADOW=true` + `RECOMMENDATION_SERVICE_URL` |
| Servir remote (après `/v1/rank` réel) | `RECOMMENDATION_ENGINE=remote`                              |

## Dashboard

`/ai` back-office, permission `ai:admin` (rôle ANALYST après re-seed).

## Permission

Les bases déjà seedées n’ont pas `ai:admin` tant que le seed n’est pas ré-exécuté (ou insertion manuelle `Permission` + `RolePermission`). SUPER_ADMIN avec `*` continue d’accéder.

## Ne pas faire

- Pointer `RECOMMENDATION_ENGINE=remote` tant que FastAPI n’implémente pas `/v1/rank` (repli permanent).
- Journaliser le texte des conversations.
- Déployer un nouveau prompt OpenAI sans les tests d’injection / UUID.
