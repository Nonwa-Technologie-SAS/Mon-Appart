# Hypothèses de pricing et monétisation GTM

**Statut :** hypothèses · **Date :** 2026-10-22  
Source produit : [billing-payments-monetization.md](./billing-payments-monetization.md), ADR 0013.

---

## 1. Clarifications essentielles

| Flux                          | Qui encaisse ?                                                           |
| ----------------------------- | ------------------------------------------------------------------------ |
| Loyer / prix de vente du bien | Parties à la transaction (hors plateforme)                               |
| Frais d’agence traditionnels  | Agence / usages locaux                                                   |
| Revenus Mon Appart            | Uniquement services plateforme (abonnements, visibilité…) **si** activés |

Mon Appart **n’encaisse pas** loyers ni prix d’achat dans le modèle Billing actuel (genre `SUBSCRIPTION_PLAN` seulement).  
PSP réel : **non intégré** ; mock refusé en staging/prod/live.

---

## 2. Options évaluées

| Option                           | Pertinence démarrage      | Risque                         | Dépendance                |
| -------------------------------- | ------------------------- | ------------------------------ | ------------------------- |
| Publication gratuite             | **Recommandée** Phase A–B | Faible                         | Plan FREE seed déjà prévu |
| Annonces mises en avant          | Phase C si liquidité      | Frustration si payant trop tôt | Catalogue billing + UI    |
| Packs de visibilité              | Idem                      | Idem                           | Idem                      |
| Abonnements pro (quota)          | Après preuve leads        | Fuite agences                  | Billing + quotas          |
| Outils gestion agences           | Différenciation B2B       | Effort produit                 | Roadmap                   |
| Génération prospects payante     | Après mesure CPL          | Confiance                      | Tracking contacts         |
| Services annexes (photos, vérif) | Opportunité ops           | Capacité terrain               | Hors core                 |

---

## 3. Stratégie progressive (hypothèse)

```
Phase A–B : FREE illimité (ou soft quota généreux) → maximiser offre qualité
Phase C   : option mise en avant volontaire
Post-preuve leads : abonnement agence / packs
PSP live  : seulement après validation métier + juridique + prestataire
```

**Risque monétisation précoce :** réduction du stock, abandon propriétaires, CAC avant product-market fit.

---

## 4. Hypothèses de prix (à valider — non publiées comme faits)

Toute grille XOF ci-dessous est une **hypothèse de discussion interne**, pas un tarif commercial engagé.

| Offre       | Hypothèse de discussion              | Signal de validation              |
| ----------- | ------------------------------------ | --------------------------------- |
| FREE        | 0 XOF, quota élevé                   | Partenaires acceptent de publier  |
| Boost 7 j   | Prix symbol « café / semaine » local | A/B willingness après leads       |
| Pro mensuel | Lié à valeur leads mesurée           | ≥ N contacts / mois perçus utiles |

Ne pas publier ces montants externes tant que non approuvés.

---

## 5. Lien unit economics

Voir [gtm-budget-and-unit-economics.md](./gtm-budget-and-unit-economics.md).  
Sans dépenses importées dans le BI, **pas de CAC/ROAS automatiques** aujourd’hui.
