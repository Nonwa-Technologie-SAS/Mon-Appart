# Tests PWA & mobile

## Web / PWA

```bash
pnpm --filter @mon-appart/web test
pnpm --filter @mon-appart/web test:e2e
pnpm --filter @mon-appart/web build
```

Couverture E2E PWA (`e2e/pwa.spec.ts`) :

- Manifeste JSON
- Icônes PNG
- Page `/offline`
- Présence de `sw.js` (logique privée /api /espace)

Le SW n’est **pas** enregistré en `next dev` : les tests d’installation réelle se font sur un build `next start` ou un déploiement HTTPS.

## Expo

```bash
pnpm --filter mobile-app lint   # si configuré
# flutter analyze / flutter test : N/A (pas de projet Flutter)
```

## Résilience

À valider manuellement (DevTools) :

1. Offline → navigation → page `/offline`
2. Application Update → bannière Recharger
3. Publication : couper le réseau → texte restauré via sessionStorage
4. Compte connecté : vérifier qu’aucune réponse `/api` n’apparaît dans Cache Storage
