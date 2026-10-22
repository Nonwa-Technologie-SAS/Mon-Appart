# Roadmap produit (Now / Next / Later)

**Statut :** propositions basées sur l’audit du dépôt — **pas des engagements datés**. Aucune métrique d’adoption inventée.

Légende statut : `livré-code` · `partiel` · `proposé` · `bloqué-externe`

## Inventaire rapide (audit)

| Zone | État |
| --- | --- |
| Auth Nest + profil web | livré-code |
| Catalogue / search Postgres | livré-code |
| Publish éditeur + espace | livré-code |
| Visites / favoris | livré-code |
| Assistant + reco UI | livré-code (flags) |
| Admin modération | partiel / socle |
| Billing | partiel (mock) |
| OpenSearch | code, off par défaut |
| Mobile Expo | partiel ; Flutter later |
| Staging/prod Cloud | bloqué-externe |

## Now (priorités immédiates)

| ID | Item | Segment | Objectif | Impact/Effort/Conf. | Dépendances | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| RM-01 | Stabiliser parcours search → fiche → contact | Chercheurs | Contact fiable | 5/2/H | API Nest, web | livré-code — durcir e2e |
| RM-02 | Publish propriétaire sans legacy Prisma web | Owners | Annonces qualité | 5/2/H | Nest cutover | livré-code |
| RM-03 | Staging + backups + smoke | Ops | Lancement sûr | 5/3/M | Cloud | proposé / bloqué-externe |
| RM-04 | Baseline analytics consent + événements cœur | Tous | Mesure | 4/2/M | Tracker web | partiel |
| RM-05 | Checklist go-live + pages légales à valider | Tous | Confiance | 5/2/L | Juridique | proposé |

## Next

| ID | Item | Objectif | Notes |
| --- | --- | --- | --- |
| RM-10 | Modération workflow admin mature | Confiance | Back-office existant à endurcir |
| RM-11 | Notifications e-mail/SMS réels | Rétention | Providers config |
| RM-12 | Assistant : qualité critères + eval | Différenciation | Flag `web_assistant` |
| RM-13 | Reco : mesurer CTR contact (pas clics seuls) | Pertinence | Flag `web_recommendations` |
| RM-14 | OpenSearch si search Postgres saturé | Perf | Flag `search_opensearch` |

## Later

| ID | Item | Notes |
| --- | --- | --- |
| RM-20 | PSP paiement réel | Validation métier/légale |
| RM-21 | Flutter mobile | Décision produit |
| RM-22 | Partenaires scale | Module partners présent |
| RM-23 | A/B productisé | Volume insuffisant aujourd’hui — voir experimentation |

## Objectifs métier (sans cibles chiffrées inventées)

1. Annonces de qualité publiées.
2. Pertinence search.
3. Taux de contact utile.
4. Confiance / signalements.
5. Temps pour trouver un bien adapté.
6. Revenus payants — **après** PSP.
7. Réduction incidents — SRE.

Établir une **baseline** analytics avant tout objectif %.
