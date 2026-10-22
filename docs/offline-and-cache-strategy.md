# Stratégie cache & hors ligne

## Ce qui est mis en cache

Cache nommé `mon-appart-static-v1` :

1. **Précache** : `/offline`, icônes, logo, manifeste.
2. **Cache-first** : `/_next/static/*`, `/icons/*`, polices `.woff2`.
3. **Navigations document** : network-first → fallback `/offline` si le réseau échoue.

Les anciennes clés `mon-appart-*` sont purgées à l’activation.

## Ce qui est exclu (jamais intercepté / jamais mis en cache SW)

- `/api/*` (sessions, mutations, données)
- `/espace*`, `/connexion*`, `/inscription*`, `/admin*`
- Toute requête non-GET
- Origines tierces (images blob, etc.) — le SW ne les traite pas

## Données privées

- Pas de cache SW pour profils, conversations, paiements, documents.
- Brouillon publication : **sessionStorage** texte uniquement (`lib/publish-draft.ts`), effacé après succès. Pas de photos / secrets.
- Auth Better Auth : cookies HttpOnly côté serveur — ne pas déplacer vers localStorage.

## UX hors ligne

- Page `/offline` : message explicite + réessai.
- Bandeau `NetworkStatus` si `navigator.onLine === false`.
- Erreurs réseau : `lib/network.ts` (`OfflineError`, timeout) — jamais de succès simulé.

## Fraîcheur des annonces

Les résultats de recherche et fiches restent **toujours** issus du réseau lorsqu’il est disponible. Hors ligne, on n’affiche pas un catalogue inventé ou un cache d’API.
