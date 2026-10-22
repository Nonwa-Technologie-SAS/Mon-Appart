# Gouvernance des données — recommandation & analytics

## Minimisation

- Analytics métier : identifiants publics / internes, codes, compteurs — pas de texte libre de conversation
- Profil comportemental : agrégats lieux / types / équipements, pas de contenu d’annonce privé d’autrui dans les explications
- Sessions anonymes pour vues optionnelles (`session_id` ≤ 64)

## Accès

- Favoris / préférences / feedback / clear profil : utilisateur authentifié propriétaire uniquement
- Agrégats admin analytics : rôles admin
- Pas d’exposition des scores dimensionnels internes dans l’API publique

## Conservation

- Analytics : `ANALYTICS_RETENTION_DAYS` (défaut 395)
- Recommandations persistées : `RECOMMENDATION_TTL_DAYS`
- Profil comportemental : recalcul / purge manuelle via `DELETE .../behavior-profile`

## Droits

L’implémentation technique facilite accès / correction / suppression des préférences et du profil inféré. **La conformité légale ivoirienne n’est pas garantie par le seul code** — validation juridique requise pour la mise en production.

## Séparation

Identité (Identity) ≠ événements analytiques (pseudonymisation via ids internes) ≠ contenu messaging.
