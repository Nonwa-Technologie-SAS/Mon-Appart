# Configuration fournisseur IA

## Variables (`packages/config` + `.env.example`)

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `AI_ASSISTANT_ENABLED` | `true` | Active le module |
| `AI_ASSISTANT_PROVIDER` | `rules` | `rules` \| `openai` |
| `OPENAI_API_KEY` | vide | Requis seulement pour reformuler via OpenAI |
| `AI_ASSISTANT_OPENAI_MODEL` | `gpt-4o-mini` | Modèle Chat Completions |
| `AI_ASSISTANT_TIMEOUT_MS` | `8000` | Timeout HTTP OpenAI |
| `AI_ASSISTANT_MAX_TOKENS` | `400` | Plafond tokens sortie |
| `AI_ASSISTANT_MAX_MESSAGE_LENGTH` | `2000` | Taille message utilisateur |
| `AI_ASSISTANT_MAX_HISTORY_TURNS` | `12` | Historique en mémoire |
| `AI_ASSISTANT_CONVERSATION_TTL_HOURS` | `24` | TTL conversations |
| `AI_ASSISTANT_SEARCH_LIMIT` | `12` | Limite Search par tour |
| `AI_ASSISTANT_RATE_LIMIT` | `30` | Reqêtes / minute / IP |
| `NEXT_PUBLIC_NEST_API_URL` | — | Base URL Nest pour `apps/web` |

## Statut de connexion

- **Sans `OPENAI_API_KEY`** ou `AI_ASSISTANT_PROVIDER=rules` : fonctionnement complet via règles + Search. Aucun appel OpenAI.
- **Avec clé + `provider=openai`** : OpenAI reformule uniquement le texte ; en échec → repli `rules`.
- **Ne jamais** placer la clé OpenAI dans le frontend.

## Coûts

Limiter historique, tokens, timeout et rate limit. L’extraction NLU n’appelle pas le LLM.
