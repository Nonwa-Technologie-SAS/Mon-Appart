# Évaluation LLM et gouvernance des prompts

## Rôle réel du LLM

Par défaut `AI_ASSISTANT_PROVIDER=rules`. OpenAI, s’il est activé, **reformule** un message déjà calculé. L’extraction des critères est `extractCriteria` (déterministe).

Prompt versionné : `assistant-reply-v1` (`composeAssistantSystemPrompt`). Rollback = `AI_ASSISTANT_PROVIDER=rules`.

## Jeu golden (synthétique)

`ASSISTANT_EVAL_CASES` : recherche simple, budget, géo ambiguë, critères combinés, budget absent, contradiction, injection, données privées, conseil juridique. Marqué `synthetic: true`.

## Hallucinations

Contrôles : Search = seules les annonces PUBLISHED ; UUID hors catalogue retirés ; message trop court → texte déterministe ; comparaison limitée aux `listingIds` de la conversation.

Aucun dataset de conversations production n’est utilisé pour l’évaluation (store mémoire, pas d’export).

Complète `docs/ai-evaluation.md` et `docs/ai-assistant-architecture.md`.
