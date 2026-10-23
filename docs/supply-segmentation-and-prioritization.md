# Segmentation fournisseurs et priorisation géographique

**Date :** 2026-10-22 · Zones pilotes proposées : **Cocody**, **Marcory** (extension : Yopougon).

---

## 1. Segments fournisseurs

### A — Propriétaires particuliers

|                |                                                                     |
| -------------- | ------------------------------------------------------------------- |
| PV             | Publier simplement, contacts plus ciblés, aide photos/infos         |
| Objections     | « Déjà sur WhatsApp », peur de complexité, peur arnaque plateformes |
| Cycle          | Court (jours)                                                       |
| Accompagnement | Démo 1:1, publication assistée                                      |
| Succès         | 1 annonce active confirmée + réponse aux contacts                   |

### B — Petites agences

|                |                                                                       |
| -------------- | --------------------------------------------------------------------- |
| PV             | Canal supplémentaire **s’il** rapporte des leads ; onboarding assisté |
| Objections     | Multi-portails, temps, « on a déjà Batirici / Keur »                  |
| Cycle          | 1–3 semaines                                                          |
| Accompagnement | Compte AGENCY + 3–10 annonces seed                                    |
| Succès         | ≥1 annonce PUBLISHED + traitement des demandes                        |

### C — Agences établies

|                |                                                                          |
| -------------- | ------------------------------------------------------------------------ |
| PV             | Import CSV (dry-run actuel) puis application contrôlée ; reporting futur |
| Objections     | Intégration SI, droits de publication, ROI                               |
| Cycle          | Long                                                                     |
| Accompagnement | Fiche Partner + SupplyLead lié                                           |
| Succès         | Lot validé + annonces live + SLA réponse                                 |

### D — Promoteurs / gestionnaires

|            |                                                         |
| ---------- | ------------------------------------------------------- |
| PV         | Mise en avant programmes disponibles réellement         |
| Objections | Sync, exclusivité                                       |
| Cycle      | Long                                                    |
| Succès     | Offres disponibles confirmées (pas catalogues fantômes) |

### E — Spécialistes terrains

|              |                                       |
| ------------ | ------------------------------------- |
| PV           | Visibilité avec encadrement docs      |
| Objections   | Charge documentaire                   |
| Cycle        | Moyen                                 |
| **Priorité** | **Différée** — risque fraude / titres |
| Succès       | Process vérif dédié avant volume      |

---

## 2. Fiches zones candidates

### Cocody (pilote A)

| Champ              | Contenu                                           |
| ------------------ | ------------------------------------------------- |
| Segments           | Owners standing + petites agences Riviera / Angré |
| Types prioritaires | Appartements & villas location LD                 |
| Partenaires        | Petites agences locales                           |
| Méthodes           | Prospection directe, intros, démos                |
| Logistique         | Accès agences / WhatsApp pro                      |
| Manquant           | Densité réelle Mon Appart, loyers observés sample |
| Activation si      | Accès ≥5 annonceurs potentiels + capacité vérif   |

### Marcory (pilote A)

| Champ         | Contenu                                         |
| ------------- | ----------------------------------------------- |
| Segments      | Owners + agences Zone 4 / Biétry                |
| Types         | Location appartements / villas                  |
| Méthodes      | Idem Cocody                                     |
| Contrainte    | Standing → photos / générateur souvent attendus |
| Activation si | Même critères Cocody                            |

### Yopougon (extension B)

| Champ         | Contenu                                         |
| ------------- | ----------------------------------------------- |
| Segments      | Owners volumes, budgets moyens                  |
| Types         | Appartements / maisons location                 |
| Risque        | Qualité hétérogène, vérif plus lourde           |
| Activation si | Cocody+Marcory stables (densité + réponse 48 h) |

### Autres (Abobo, Koumassi, Treichville, Port-Bouët, Bingerville, Plateau)

Évaluer après pilote A. Plateau : faible volume résidentiel. Bingerville : terrains → plus tard. Critères : voir [gtm-geographic-launch-strategy.md](./gtm-geographic-launch-strategy.md).

---

## 3. Mapping produit

| Segment       | Compte user  | SupplyLead.segment | Partner.category   |
| ------------- | ------------ | ------------------ | ------------------ |
| Owner         | OWNER        | OWNER              | — (sauf plus tard) |
| Petite agence | AGENCY       | SMALL_AGENCY       | AGENCY optionnel   |
| Grande agence | AGENCY       | ESTABLISHED_AGENCY | AGENCY             |
| Promoteur     | AGENCY/OTHER | DEVELOPER          | DEVELOPER          |
| Gestionnaire  | AGENCY       | PROPERTY_MANAGER   | PROPERTY_MANAGER   |
| Terrains      | —            | LAND_SPECIALIST    | —                  |
