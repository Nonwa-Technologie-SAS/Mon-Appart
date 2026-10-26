# Positionnement et propositions de valeur — Mon Appart

**Statut :** hypothèses à tester · **Date :** 2026-10-22  
Références produit : [product-roadmap.md](./product-roadmap.md), audit GTM Prompt 26.

---

## 1. Positionnement cadre (hypothèse)

**Pour** les personnes qui cherchent un logement à louer à Abidjan  
**qui** perdent du temps avec des annonces inadaptées ou douteuses,  
**Mon Appart** est une plateforme de mise en relation immobilière  
**qui** aide à trouver des biens **correspondant au budget et à la localisation**, avec des annonces **plus claires et mieux contrôlées**,  
**contrairement aux** portails généralistes et aux groupes informels  
**parce que** nous priorisons la **pertinence du matching** et la **qualité de l’offre** plutôt que le volume seul.

Version courte :

> « Trouvez plus vite un logement qui correspond à votre budget — avec des annonces plus fiables. »

**À ne pas dire (non démontré) :** zéro fraude · meilleurs prix garantis · trouvez forcément · IA révolutionnaire.

---

## 2. Ce que le produit peut réellement soutenir aujourd’hui

| Élément de message              | Support code               | Statut commercial                    |
| ------------------------------- | -------------------------- | ------------------------------------ |
| Recherche / filtres             | Search Nest + UI           | Utilisable si staging OK             |
| Fiche annonce + contact         | Listings + interactions    | Utilisable si contact prouvé         |
| Publication propriétaire/agence | Nest + espace              | Utilisable                           |
| Vérification identité / badges  | Trust                      | Partiel — expliquer les limites      |
| Assistant conversationnel       | Flag `web_assistant`       | Différenciation **pilote** seulement |
| Recommandations                 | Flag `web_recommendations` | Idem                                 |
| Estimation prix m² marché       | Non équivalent IvoireDomi  | Ne pas promettre                     |

---

## 3. Propositions de valeur par segment

### 3.1 Locataires

| Message                                                          | Bénéfice concret            | Preuve requise                           |
| ---------------------------------------------------------------- | --------------------------- | ---------------------------------------- |
| « Filtrez selon votre budget et votre quartier »                 | Moins de fiches hors budget | Taux de recherches avec résultats utiles |
| « Voyez clairement ce qui est vérifié — et ce qui ne l’est pas » | Confiance calibrée          | Compréhension badges en test utilisateur |
| « Contactez sans perdre la journée »                             | Gain de temps               | Délai réponse annonceur                  |

Variantes A/B (à tester) :

- A — Gain de temps
- B — Confiance / moins d’arnaques perçues
- C — Pertinence budget

### 3.2 Acheteurs (logements)

| Message                                                           | Caution                                        |
| ----------------------------------------------------------------- | ---------------------------------------------- |
| « Comparez des biens clairs, avec localisation et prix affichés » | Ne pas promettre validation juridique du titre |
| « Contactez vendeurs / agences sérieux »                          | Dépend qualité supply                          |

Priorité message : **phase 2** après densité location.

### 3.3 Propriétaires

| Message                             | Bénéfice      | Preuve                               |
| ----------------------------------- | ------------- | ------------------------------------ |
| « Publiez en quelques étapes »      | Facilité      | Temps de publication mesuré          |
| « Recevez des contacts intéressés » | Qualité leads | % contacts avec critères compatibles |
| « Suivez vos annonces »             | Contrôle      | Outils espace réellement utilisés    |

### 3.4 Agences

| Message                                                        | Bénéfice      | Preuve                           |
| -------------------------------------------------------------- | ------------- | -------------------------------- |
| « Un canal de plus **seulement s’il rapporte** des prospects » | ROI temps     | Contacts / annonce / semaine     |
| « Gérez votre portefeuille »                                   | Ops           | Quotas Billing FREE au démarrage |
| « Visibilité locale ciblée »                                   | Zones pilotes | Densité demande zone             |

### 3.5 Acheteurs de terrains

| Message                                                                   | Caution forte                                   |
| ------------------------------------------------------------------------- | ----------------------------------------------- |
| « Accédez à des annonces de terrains avec infos documentaires affichées » | Mon Appart ne garantit pas la validité foncière |
| Différer le push marketing terrains jusqu’à process vérif dédié           | Risque réputation                               |

---

## 4. Rôle de « l’intelligence » dans le message

| Formulation faible            | Formulation forte                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| « Plateforme IA immobilière » | « Indiquez budget et besoins — on vous montre d’abord les biens adaptés »                   |
| « Recommandations IA »        | « Suggestions basées sur vos critères et votre activité, pour éviter de tout re-parcourir » |

L’IA / NLU / reco **résolvent** : surcharge cognitive et temps de filtrage.  
Elles **ne résolvent pas** : fraude juridique, absence d’offre, annonceur qui ne répond pas.

---

## 5. Avantages à valider auprès des utilisateurs

1. Pertinence perçue des résultats vs portails connus.
2. Compréhension des badges de confiance.
3. Intention de republier / revenir.
4. Willingness to pay agences (plus tard).

Protocole : [gtm-customer-validation-plan.md](./gtm-customer-validation-plan.md).

---

## 6. Tone of voice

- Clair, concret, FCFA, noms de quartiers.
- Sobre sur la confiance.
- Mobile-first, WhatsApp-friendly dans le langage (sans spam).
- Français accessible (éviter jargon tech).
