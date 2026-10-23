# Stratégie d’entrée marché — Mon Appart (Côte d’Ivoire)

**Statut :** préparé (non exécuté) · **Date :** 2026-10-22  
**Périmètre :** lancement commercial progressif, Abidjan d’abord.  
**Règle :** aucune campagne payante, prospection externe ni partenariat signé sans approbation humaine.

Complète : [product-roadmap.md](./product-roadmap.md), [launch-readiness-checklist.md](./launch-readiness-checklist.md), [acquisition-channels.md](./acquisition-channels.md), [billing-payments-monetization.md](./billing-payments-monetization.md).

---

## 1. Verdict de préparation commerciale

Mon Appart dispose d’un **socle produit utilisable en pilote fermé** (auth, recherche, fiche, publication, contact, trust partiel) mais **n’est pas prêt pour un lancement public national**.

| Dimension                                   | État                                     | Implication GTM                     |
| ------------------------------------------- | ---------------------------------------- | ----------------------------------- |
| Parcours chercheur search → fiche → contact | Code livré ; e2e staging non vérifié ici | Pilote possible si smoke staging OK |
| Publication OWNER/AGENCY                    | Code livré Nest + espace web             | Acquisition offre = priorité P1     |
| Assistant / recommandations                 | Flags ; différenciation non prouvée      | Message marketing prudent           |
| Notifications réelles                       | Bloqué config providers                  | Friction rétention / OTP            |
| Paiements live                              | Mock only                                | Gratuité / freemium au démarrage    |
| Stock d’annonces                            | Absent (ops)                             | Bloquant valeur marketplace         |
| Support / CGU / restore backup              | Ops / juridique incomplets               | Bloquants lancement public          |

**Distinction critique :** application techniquement accessible ≠ marketplace commercialement crédible.

---

## 2. Thèse d’entrée (hypothèse)

> En se concentrant sur **la location résidentielle longue durée à Abidjan** (zones pilotes Cocody + Marcory, puis Yopougon), avec une **offre vérifiée et un contact fiable**, Mon Appart peut créer de la valeur avant d’élargir à l’achat/terrains et au national.

| Élément                                 | Niveau de confiance | Justification                                                       |
| --------------------------------------- | ------------------- | ------------------------------------------------------------------- |
| Concentration Abidjan                   | Élevé               | Densité d’offres concurrentes et de demande observable sur portails |
| Priorité location LD                    | Moyen               | Fréquence de recherche > fréquence d’achat ; à valider terrain      |
| Différenciation trust + matching budget | Moyen               | Code partiel ; valeur perçue non mesurée                            |
| Différenciation « IA » seule            | Faible              | Non commercialisable sans preuve de gain de temps                   |

---

## 3. Segments prioritaires (ordre proposé)

1. **Locataires Abidjan (budget moyen / standing)** — demande fréquente, cycle court.
2. **Propriétaires particuliers + petites agences** — source d’offre.
3. **Acheteurs résidentiels** — phase 2 une fois densité location OK.
4. **Acheteurs de terrains** — opportunité forte chez concurrents ; complexité confiance/titres → plus tard.
5. **Courte durée / meublé** — BIIM positionné ; éviter dilution au lancement.

Détail : [gtm-positioning-and-value-proposition.md](./gtm-positioning-and-value-proposition.md), [gtm-geographic-launch-strategy.md](./gtm-geographic-launch-strategy.md).

---

## 4. Séquence Go-to-Market

```
P0 Diagnostic → P1 Offre qualité → P2 Demande contrôlée → P3 Public progressif
```

| Phase               | Objectif                                | Critère de sortie (indicatif)                                         |
| ------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| A Préparation       | PV testée, parcours OK, process qualité | Voir [gtm-go-no-go-checklist.md](./gtm-go-no-go-checklist.md) Phase A |
| B Pilote fermé      | Matching réel offre/demande zone pilote | Contacts répondus + retours utilisateurs                              |
| C Public progressif | Canaux validés, ops stables             | Seuils Go/No-Go publics                                               |

Calendrier : [gtm-90-day-launch-plan.md](./gtm-90-day-launch-plan.md).

---

## 5. Principes non négociables

1. **Offre avant trafic** — pas d’acquisition demande massive sans densité d’annonces utiles.
2. **Qualité > volume** — [gtm-trust-and-listing-quality.md](./gtm-trust-and-listing-quality.md).
3. **Promesses = capacités vérifiées** — pas de « zéro fraude » / « IA magique ».
4. **Mesure avant scale** — [gtm-kpis-and-dashboard.md](./gtm-kpis-and-dashboard.md).
5. **Monétisation progressive** — [gtm-pricing-and-monetization-hypotheses.md](./gtm-pricing-and-monetization-hypotheses.md).

---

## 6. Décisions humaines requises

| Décision                                  | Statut                    |
| ----------------------------------------- | ------------------------- |
| Valider zones pilotes Cocody + Marcory    | En attente d’approbation  |
| Budget scénario minimal / intermédiaire   | En attente                |
| Autoriser prospection terrain partenaires | En attente                |
| Autoriser campagnes payantes pilotes      | En attente (défaut : non) |
| Validation juridique CGU / données        | En attente professionnel  |

---

## 7. Index des livrables GTM

| Document                                                                                   | Sujet               |
| ------------------------------------------------------------------------------------------ | ------------------- |
| [gtm-ivory-coast-market-research.md](./gtm-ivory-coast-market-research.md)                 | Marché CI           |
| [gtm-competitive-analysis.md](./gtm-competitive-analysis.md)                               | Concurrents         |
| [gtm-positioning-and-value-proposition.md](./gtm-positioning-and-value-proposition.md)     | Positionnement      |
| [gtm-customer-validation-plan.md](./gtm-customer-validation-plan.md)                       | Validation          |
| [gtm-geographic-launch-strategy.md](./gtm-geographic-launch-strategy.md)                   | Géographie          |
| [gtm-supply-acquisition-playbook.md](./gtm-supply-acquisition-playbook.md)                 | Acquisition offre   |
| [gtm-demand-acquisition-playbook.md](./gtm-demand-acquisition-playbook.md)                 | Acquisition demande |
| [gtm-trust-and-listing-quality.md](./gtm-trust-and-listing-quality.md)                     | Confiance           |
| [gtm-pricing-and-monetization-hypotheses.md](./gtm-pricing-and-monetization-hypotheses.md) | Monétisation        |
| [gtm-budget-and-unit-economics.md](./gtm-budget-and-unit-economics.md)                     | Budgets             |
| [gtm-kpis-and-dashboard.md](./gtm-kpis-and-dashboard.md)                                   | KPIs                |
| [gtm-partnership-distribution-plan.md](./gtm-partnership-distribution-plan.md)             | Partenaires         |
| [gtm-support-and-operations.md](./gtm-support-and-operations.md)                           | Support             |
| [gtm-90-day-launch-plan.md](./gtm-90-day-launch-plan.md)                                   | 90 jours            |
| [gtm-go-no-go-checklist.md](./gtm-go-no-go-checklist.md)                                   | Go/No-Go            |
