# Sécurité et vie privée — Assistant IA

## Principes

- Le LLM ne décide ni des permissions, ni de la visibilité des annonces, ni des actions admin / paiement.
- Search applique les règles métier (publié uniquement).
- Descriptions d’annonces = données, jamais instructions système (OpenAI ne reçoit que des cartes déjà filtrées).
- Pas d’outil SQL / shell / URL arbitraire.

## Contrôles V1

- Rate limit (`AI_ASSISTANT_RATE_LIMIT`).
- Longueur max des messages.
- Isolation conversations : `user.id` ou `x-assistant-session` / empreinte IP+UA.
- Comparaison limitée aux `listingIds` déjà présentés dans la conversation.
- Sanitisation des UUID inventés dans les sorties OpenAI.
- Timeout fournisseur + repli rules.
- Pas de secrets dans les réponses API.

## Données envoyées à OpenAI (si activé)

Résumé de critères + titres / prix / lieux / raisons des cartes Search (max 8). Pas de tokens d’auth, pas d’emails, pas de prompts système utilisateur.

## Limites restantes

- Store en mémoire (pas multi-instance).
- Pas de chiffrement au repos des conversations.
- Feedback accepté mais non persisté durablement.
