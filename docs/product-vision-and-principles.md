# Vision produit et principes

## Vision (cible)

Mon Appart aide les Ivoiriens à **trouver et proposer** un logement ou un bien de confiance : recherche locale (commune, quartier, budget FCFA), annonces vérifiables, mise en relation efficace, expérience mobile simple.

## Différenciation (à mesurer, pas à déclarer acquise)

| Capacité | Intention | État dépôt (audit) |
| --- | --- | --- |
| Reco budget / besoins | Pertinence sans inventer d’annonces | Moteur **rules** opérationnel ; remote optionnel |
| Recherche NL / assistant | Demande en français → filtres | Module AI + UI web présents |
| Confiance / vérif | Réduire arnaques | Trust + admin moderation présents |
| Contact / visites | RDV structurés | Appointments Nest + UI demande visite |
| Services payants | Monetisation | Billing **mock only** — pas de PSP réel |

## Principes

1. **Vérité des données** : PostgreSQL ; pas d’annonces inventées dans l’assistant/reco.
2. **Confiance avant volume** : modération et signaux anti-fraude prioritaires au lancement.
3. **Mobile-first** : parcours courts, peu de friction réseau.
4. **Mesurer avant d’élargir** : baseline analytics avant objectifs chiffrés.
5. **Livrer petit, souvent** : flags + releases contrôlées plutôt que big-bang.
6. **Simplicité ops** : pas de plateforme produit/flags complexe sans besoin.

## Non-objectifs (phase actuelle)

- Marketplace de paiement escrow.
- App Flutter (Expo existant ; Flutter reporté).
- OpenSearch / ML lourds sans métriques de recherche.