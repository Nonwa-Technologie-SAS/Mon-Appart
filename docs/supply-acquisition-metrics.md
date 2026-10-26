# Métriques d’acquisition de l’offre

**Date :** 2026-10-22 · Réutilise [gtm-kpis-and-dashboard.md](./gtm-kpis-and-dashboard.md), Growth/BI.

---

## 1. Acquisition commerciale

| KPI                  | Définition                      | Formule          | Source     | Fréquence | Limites              |
| -------------------- | ------------------------------- | ---------------- | ---------- | --------- | -------------------- |
| Prospects identifiés | Leads créés                     | Count SupplyLead | API/DB     | Hebdo     | Manuel               |
| Contactés            | stage ≥ CONTACTED               | Count            | SupplyLead | Hebdo     |                      |
| Qualifiés            | stage ≥ QUALIFIED               | Count            |            | Hebdo     | Subjectif            |
| Démos                | interactions DEMO ou stage DEMO | Count            |            | Hebdo     |                      |
| Inscriptions         | stage ≥ REGISTERED              | Count            |            | Hebdo     | ≠ activés            |
| Activés              | stage ACTIVATED/NURTURE         | Count            |            | Hebdo     | Règle activeListings |
| Conversion étape     | n(stage+1)/n(stage)             | Ratio            |            | Hebdo     | Petits n             |
| Temps conversion     | Médiane created→ACTIVATED       | Jours            |            | Mensuel   |                      |
| Motifs refus         | refusalReason                   | Group by         |            | Mensuel   |                      |
| Coût / canal         | Dépenses / activés              | Manuel           | Sheet      | Mensuel   | Pas dans BI          |

---

## 2. Stock

| KPI                                                                           | Source Listing / ops                |
| ----------------------------------------------------------------------------- | ----------------------------------- |
| Soumises / approuvées / publiées / actives / confirmées / rejetées / expirées | Statuts + flags ops                 |
| Doublons détectés                                                             | Ops log                             |
| Completeness                                                                  | qualityScore search doc / checklist |
| Répartition catégorie × zone × budget                                         | Cubes listings                      |

**Offre utile** = active confirmée, pas soumise brute.  
Property unique ≠ plusieurs Listings (types) : éviter double comptage métier.

---

## 3. Performance partenaires

Annonces actives / partenaire · délai réponse · taux MAJ · contacts reçus/traités · actifs 30 j · inactifs à réactiver.

---

## 4. Instrumentation manquante

- Sync auto compteurs SupplyLead ← Listing
- Import dépenses → CAC
- Alertes zero-result par zone

Événements existants : privilégier avant nouveaux trackers.
