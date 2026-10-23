# Stratégie d’acquisition et constitution du stock initial

**Statut :** opérationnel documenté · **Date :** 2026-10-22  
**Prospection réelle :** soumise à autorisation explicite.

Complète : [gtm-supply-acquisition-playbook.md](./gtm-supply-acquisition-playbook.md), [gtm-geographic-launch-strategy.md](./gtm-geographic-launch-strategy.md), modules Partner / Listing / Trust.

---

## 1. Question centrale

Comment obtenir les **premières annonces de qualité**, convaincre les titulaires de les publier, vérifier les infos, maintenir la disponibilité, et servir réellement les demandeurs ?

**Réponse cadre :** périmètre géographique étroit (Cocody + Marcory) · catégories prioritaires location LD · prospection directe accompagnée · qualité avant volume · pipeline `SupplyLead` (admin) distinct du registre Partner.

---

## 2. Ordre de lancement des catégories

| Rang | Catégorie                       | Demande  | Facilité offre | Qualité info | Renouvellement | Fraude         | Vérif          | Contacts | Capacité produit     | Décision                  |
| ---- | ------------------------------- | -------- | -------------- | ------------ | -------------- | -------------- | -------------- | -------- | -------------------- | ------------------------- |
| 1    | Appartements à louer            | Haute    | Haute          | Haute        | Haute          | Moyen          | Moyen          | Haute    | OK                   | **Pilote**                |
| 2    | Maisons / villas à louer        | Haute    | Moyenne        | Haute        | Moyen          | Moyen          | Moyen          | Haute    | OK                   | **Pilote**                |
| 3    | Agences (portefeuille location) | —        | Haute volume   | Variable     | Haute          | Moyen          | Process        | Haute    | OK + CSV dry-run     | **Pilote**                |
| 4    | Propriétaires particuliers      | —        | Haute          | Variable     | Moyen          | Moyen          | Accompagnement | Haute    | OK                   | **Pilote**                |
| 5    | Achat appartements / maisons    | Moyenne  | Moyenne        | Variable     | Basse          | Élevé          | Élevé          | Moyen    | OK                   | Phase 2                   |
| 6    | Courte durée / meublé           | Variable | Moyenne        | Variable     | Très haute     | Moyen          | Élevé ops      | Haute    | Type SHORT_TERM_RENT | Plus tard                 |
| 7    | Terrains                        | Visible  | Variable       | Risquée      | Moyen          | **Très élevé** | Élevé          | Moyen    | LAND                 | Plus tard + process dédié |

---

## 3. Taxonomie du stock (ne pas confondre)

| État                          | Définition                                  | Compte comme « offre utile » ? |
| ----------------------------- | ------------------------------------------- | ------------------------------ |
| Collectée                     | Infos reçues hors plateforme                | Non                            |
| Soumise                       | Listing créé (souvent DRAFT)                | Non                            |
| En vérification               | PENDING_REVIEW / Trust                      | Non                            |
| Approuvée                     | Contrôles qualité OK (ops)                  | Conditionnel                   |
| Publiée                       | `PUBLISHED`                                 | Oui si fraîche                 |
| Active confirmée              | Publiée + dispo reconfirmée selon procédure | **Oui (cible)**                |
| Expirée / suspendue / retirée | EXPIRED, SUSPENDED, ARCHIVED, etc.          | Non                            |

Objectifs de volume : **scénarios pilotes** dans [supply-pilot-30-day-plan.md](./supply-pilot-30-day-plan.md), pas des cibles inventées.

---

## 4. Zones

Voir [supply-segmentation-and-prioritization.md](./supply-segmentation-and-prioritization.md) et GTM géo.  
Activation : Cocody + Marcory d’abord ; Yopougon en extension.

---

## 5. Système de suivi

| Besoin                                 | Outil                                                           |
| -------------------------------------- | --------------------------------------------------------------- |
| Pipeline terrain (owners + agences)    | `SupplyLead` + admin `/supply-leads` · API `admin/supply-leads` |
| Registre intégrations / CSV / webhooks | Module `Partner` existant                                       |
| Annonces                               | Listing + Property Nest                                         |
| Qualité / fraude                       | Trust + admin listings                                          |

**Règle :** ne pas créer un second Partner ni un second workflow Listing.

---

## 6. Principes

1. Autorisation avant prospection / import.
2. Pas de scraping concurrents.
3. Pas de promesses de volume de clients.
4. Activation = annonce(s) active(s), pas seule inscription.
5. Incitations = aide qualité, pas fausse rareté.
