# Architecture — Assistant immobilier conversationnel

Date : 2026-10-19. Module Nest : `apps/api/src/modules/ai-assistant/`. UI : `apps/web/app/(site)/assistant`.

## Objectif

Comprendre une demande en français (marché ivoirien), la convertir en critères validés, clarifier si besoin, puis interroger le moteur **Search** existant. Le LLM n’est jamais source de vérité sur les annonces.

## Composants

| Composant | Rôle |
| --- | --- |
| `criteria-extractor` | NLU déterministe FR (intent, type, lieu, budget XOF, chambres…) |
| `location-resolver` | Communes / quartiers / villes alignés sur le seed Abidjan |
| `criteria-to-search` | Mapping → `RawSearchParams` de Search |
| `explain-matches` | Raisons de correspondance depuis champs réels |
| `ConversationStore` | Mémoire process + TTL (isolation user/session) |
| `RulesAiProvider` | Reformulation texte sans réseau (défaut) |
| `OpenAiTextProvider` | Reformulation optionnelle ; repli rules si clé absente / erreur |
| `AssistantService` | Orchestration + appels `SearchService` |
| `AiAssistantController` | API versionnée `/api/v1/ai-assistant/*` |
| `AssistantChat` (web) | UI conversationnelle ; appelle Nest via `NEXT_PUBLIC_NEST_API_URL` |

## Flux

1. Message utilisateur → validation longueur / rate limit.
2. Extraction ou fusion de critères (`extractCriteria` / `mergeCriteria`).
3. Si `clarificationQuestion` et pas de `forceSearch` → mode `clarify` (pas de Search).
4. Sinon → `SearchService.search` (annonces publiées uniquement).
5. Cartes + `matchReasons` dérivés des résultats.
6. Reformulation texte (rules ou OpenAI) **sans inventer d’IDs**.
7. Persistance conversation (critères, listingIds, messages).

## Ce qui n’est pas dans la V1

- Service Python dédié (non requis : extraction Nest suffisante).
- Embeddings / pgvector.
- Remplacement de Recommendation (non branché dans le tour ; Search reste la source).
- Persistance Postgres des conversations (mémoire + TTL 24 h par défaut).

## Endpoints

- `POST /api/v1/ai-assistant/conversations`
- `GET /api/v1/ai-assistant/conversations`
- `GET /api/v1/ai-assistant/conversations/:id`
- `DELETE /api/v1/ai-assistant/conversations/:id`
- `POST /api/v1/ai-assistant/conversations/:id/messages`
- `POST /api/v1/ai-assistant/search`
- `POST /api/v1/ai-assistant/conversations/:id/compare`
- `POST /api/v1/ai-assistant/feedback`

Header optionnel : `x-assistant-session` (UUID anonyme). Auth JWT optionnelle.

Voir aussi : `natural-language-search.md`, `ai-provider-configuration.md`, `ai-security-and-privacy.md`, `ai-evaluation.md`.
