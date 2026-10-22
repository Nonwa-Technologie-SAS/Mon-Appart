# Optimisation des parcours de conversion

## Parcours analysés (état réel)

### Recherche → contact

Landing / catalogue SEO → filtres (URL) → résultats → fiche `/annonces/...` → « Demander une visite ».

Améliorations livrées :

- Empty state : propositions d’élargissement **explicites** (liens), jamais de mutation silencieuse des critères.
- Mémorisation locale des critères (fondation alertes).
- Tracking `listing_detail_viewed`, `listing_contact_started`.
- Favoris + partage sur fiche.

Friction restante : demande de visite = stack web (`PropertyVisit`), pas Nest appointments → KPI admin Nest sous-estiment le site public.

### Publication

`/inscription/...` → `/espace/publier` → actions properties legacy.

Progression / brouillons : voir `publish-draft` existant. Ne pas promettre publication instantanée si modération Trust s’applique côté Nest.

### Contact

Ouverture dialog = intention (`listing_contact_started`). Succès = enregistrement server action visite. Anti-doublon formulaire via reset `formKey`.

## Méthode d’amélioration

1. Mesurer le funnel (consent + backend).
2. Identifier l’étape au plus fort abandon.
3. Hypothèse + variante (voir [growth-experimentation.md](./growth-experimentation.md)).
4. Garde-fous : qualité contacts, signalements, erreurs.

Ne pas optimiser uniquement les clics.
