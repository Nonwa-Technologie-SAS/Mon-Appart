# Plan de validation client — Mon Appart

**Statut :** protocoles préparés · **Aucun entretien réalisé dans le cadre de ce document** · **Date :** 2026-10-22

Objectif : tester les hypothèses **avant** un budget pub important.

---

## 1. Hypothèses prioritaires

| ID  | Hypothèse                                                  | Segment           | Risque si fausse         | Méthode                              | n cible   | Signal attendu                                   | Seuil décision (à figer avant test)        | Décision possible                               |
| --- | ---------------------------------------------------------- | ----------------- | ------------------------ | ------------------------------------ | --------- | ------------------------------------------------ | ------------------------------------------ | ----------------------------------------------- |
| H1  | Les locataires peinent à trouver un bien dans leur budget  | Locataires        | Produit mal cadré        | Entretiens + tâches recherche        | 12–15     | ≥70 % citent budget/localisation comme top pain  | Si &lt;50 % → revoir segment ou message    | Poursuivre / modifier / abandonner angle budget |
| H2  | Ils veulent plus vite des biens adaptés                    | Locataires        | Assistant/reco inutiles  | Test utilisateur search vs assistant | 8–10      | Temps / satisfaction tâche                       | Définir baseline manuelle                  | Investir ou geler assistant                     |
| H3  | Les propriétaires veulent des contacts vraiment intéressés | Owners            | Acquisition offre échoue | Entretiens + test publish            | 8–10      | ≥6/10 jugent leads multi-canal « non qualifiés » | Si non → autre promesse (visibilité seule) | Ajuster PV propriétaire                         |
| H4  | Les agences publient si leads qualifiés                    | Agences           | Canal B2B mort           | Entretiens + essai publication       | 6–8       | ≥4 acceptent pilote 30 j si leads suivis         | Si &lt;2 → focus particuliers              | Prioriser ou non agences                        |
| H5  | La vérification augmente la confiance                      | Demandeurs        | Trust inutile            | Concept test badges                  | 10        | Lift confiance déclaré + compréhension           | Si confusion badges → redesign copy        | Clarifier niveaux                               |
| H6  | Les reco personnalisées aident                             | Demandeurs actifs | Feature coûteuse         | A/B soft / diary study               | 15+ usage | CTR contact sur reco &gt; browse                 | Seuil après baseline                       | Flag on/off                                     |

n justifiés : saturation qualitative exploratoire (B2C ~12–15 ; B2B agences plus rares → 6–8).

---

## 2. Méthodes complémentaires

| Méthode                    | Objectif                         | Exécuté ?                  |
| -------------------------- | -------------------------------- | -------------------------- |
| Entretiens demandeurs      | Jobs-to-be-done, canaux actuels  | Non                        |
| Entretiens propriétaires   | Motifs publish, attentes leads   | Non                        |
| Entretiens agences         | Critères multi-portail           | Non                        |
| Tests utilisateurs produit | Frictions search/publish/contact | Non                        |
| Analyse parcours analytics | Funnels réels                    | Partiel (instrumentation)  |
| Test publication annonce   | Qualité process                  | Non                        |
| Test qualité contact       | Réponse annonceur                | Non                        |
| Landing / campagne pilote  | Intent payant                    | Non (autorisation requise) |

---

## 3. Guide d’entretien — Locataire (30–40 min)

**Recrutement :** cherche un logement à Abidjan (30 j) ou a cherché &lt;6 mois. Mix Cocody/Marcory/Yopougon.

Questions :

1. Comment cherchez-vous aujourd’hui (WhatsApp, Facebook, site, agence) ?
2. Combien de temps / semaine ?
3. Qu’est-ce qui fait abandonner une annonce ?
4. Budget max et flexibilité ?
5. Qu’est-ce qui crée la confiance / la méfiance ?
6. Dernier contact : a-t-il abouti ? Pourquoi ?
7. Montrer 3 écrans Mon Appart (prototype ou staging) — tâche : trouver un 2 pièces &lt; X FCFA à [quartier].
8. Note 1–5 utilité ; qu’est-ce qui manque ?

**Grille :** pain intensité, canal dominant, seuil confiance, intention d’usage (déclaratif ≠ comportement).

---

## 4. Guide — Propriétaire / petite agence

1. Combien de biens gérés / publiés ?
2. Où publiez-vous aujourd’hui ?
3. Combien de contacts / semaine ? Combien « sérieux » ?
4. Qu’est-ce qu’un contact qualifié pour vous ?
5. Seriez-vous prêt à publier sur une nouvelle plateforme ? Conditions ?
6. Tâche : publier une annonce (ou dry-run).
7. Qu’attendez-vous comme reporting ?

---

## 5. Tests comportementaux (prioritaires)

| Test          | Action concrète                     | Métrique                      |
| ------------- | ----------------------------------- | ----------------------------- |
| T1 Publish    | 5 propriétaires publient réellement | Temps, erreurs, complétion    |
| T2 Contact    | 20 contacts sur annonces seed       | Taux réponse 48 h             |
| T3 Matching   | Locataire avec critères fixes       | % résultats jugés pertinents  |
| T4 Retour J+7 | Relance utilisateurs pilote         | Retour volontaire / re-visite |

---

## 6. Règles d’interprétation

- Intention déclarée (« je paierais ») ≠ conversion.
- Préférer actions : publish, contact, RDV.
- Documenter biais de recrutement (amis, tech-savvy).
- Ne pas publier de « taux de succès » inventés.

---

## 7. Livrables attendus après exécution

- Synthèse insights (max 5 pages).
- Décision H1–H6 (poursuivre / modifier / abandonner).
- Backlog frictions P0.
- Go / Hold sur assistant & reco.

**Responsable à désigner :** Product Marketing + Ops terrain.
