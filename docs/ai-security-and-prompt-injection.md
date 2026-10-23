# Sécurité IA et injection de prompt

Complète `docs/ai-security-and-privacy.md`.

## Surface

- Messages utilisateur, descriptions d’annonces, documents = **non fiables**.
- L’assistant n’a pas d’outil SQL, paiement, admin, ni accès secrets.
- OpenAI ne reçoit que des cartes Search déjà autorisées (max 8) + résumé de critères.

## Contrôles

- `looksLikePromptInjection` : compteur, **pas un blocage** (évite les faux positifs sur le français courant).
- `sanitizeAssistantReply` : retire les UUID hors catalogue.
- Rate limit `AI_ASSISTANT_RATE_LIMIT`.
- Isolation de conversation (user id ou session anonyme).
- Compare : uniquement les ids déjà présentés.

## Tests

`output-sanitize.spec.ts`, cas `injection` du jeu golden, tests session 404.

Le LLM ne peut pas publier une annonce, suspendre un compte ou envoyer un message engageant.
