# Tableau de bord Go-to-Market — définitions

**Statut :** spécification · **Pas de dashboard fictif alimenté** · **Date :** 2026-10-22  
Réutilise : [growth-metrics-and-funnels.md](./growth-metrics-and-funnels.md), [bi-metrics-catalog.md](./bi-metrics-catalog.md) si présent, Analytics Nest, UTM.

---

## 1. Principes de mesure

- Une métrique = une définition écrite.
- Consentement analytics respecté.
- `listing_contact_started` (client) ≠ contact soumis serveur.
- Pas de CAC automatique sans import dépenses.
- Pas d’affichage de valeurs inventées dans l’admin.

---

## 2. Acquisition de l’offre

| KPI                     | Définition                         | Formule                 | Source              | Fréquence | Limites              | Owner   |
| ----------------------- | ---------------------------------- | ----------------------- | ------------------- | --------- | -------------------- | ------- |
| Propriétaires contactés | Prospects supply contactés ≥1 fois | Count stage ≥ CONTACTED | Sheet CRM léger     | Hebdo     | Manuel               | BD      |
| Partenaires qualifiés   | Droits + zone + ≥1 bien            | Count QUALIFIED         | Sheet               | Hebdo     | Subjectif            | BD      |
| Partenaires activés     | ≥1 annonce LIVE                    | Count                   | DB listings + sheet | Hebdo     |                      | BD      |
| Annonces soumises       | Créées (tous statuts)              | Count                   | Nest listings       | Quotidien |                      | Ops     |
| Annonces publiées       | Statut publié                      | Count                   | Nest                | Quotidien |                      | Ops     |
| Actives vérifiées       | Publiées + contrôles OK            | Count                   | Ops flag / Trust    | Hebdo     | Process manuel début | Qualité |
| Délai moyen publication | Soumission → live                  | Médiane heures          | Timestamps          | Hebdo     |                      | Ops     |
| Coût / annonce qualité  | Voir budget doc                    | Formule                 | Finance + ops       | Mensuel   | Estimé               | Growth  |

---

## 3. Acquisition de la demande

| KPI                   | Définition                           | Source              | Fréquence | Limites               |
| --------------------- | ------------------------------------ | ------------------- | --------- | --------------------- |
| Visiteurs             | Sessions / users consent             | Analytics           | Quotidien | Attribution partielle |
| Inscrits              | Comptes créés                        | Identity            | Quotidien |                       |
| Activés seeker        | Déf. growth (`activated_seeker`)     | Events              | Hebdo     | Partiel               |
| Recherches            | Search events / API                  | Search + analytics  | Quotidien |                       |
| Consultations fiches  | Listing views                        | Analytics           | Quotidien |                       |
| Users avec ≥1 contact | Distinct actors contact submitted    | Server interactions | Hebdo     |                       |
| Coût / activé         | Budget demande / activés             | Manuel              | Mensuel   |                       |
| Conversion par canal  | Funnel × `acquisition_touch.channel` | Growth              | Hebdo     | UTM qualité           |

---

## 4. Qualité du matching

| KPI                       | Définition                       | Limites             |
| ------------------------- | -------------------------------- | ------------------- |
| Recherches avec résultats | Search hits &gt; 0               | « Pertinent » ≠ hit |
| Pertinence déclarée       | Survey / test UX                 | Petit n             |
| View → contact            | Contacts / views                 |                     |
| Contacts qualifiés        | Déf. ops (ex. budget compatible) | Manuel début        |
| Réponses annonceurs 48 h  | Réponses / contacts              | Messaging / ops     |
| RDV / visites             | Appointments module              | Si instrumenté      |
| Zero-result rate          | Searches sans hit                | Alerte supply       |
| CTR reco → contact        | Si flag reco                     | Volume bas          |
| Taux signalement          | Reports / actives                |                     |

---

## 5. Santé marketplace

| KPI                           | Définition                                                       |
| ----------------------------- | ---------------------------------------------------------------- |
| Ratio demande/offre           | Ex. recherches zone / annonces actives zone — documenter fenêtre |
| Actives / zone / catégorie    | Cubes listings                                                   |
| Part obsolètes                | Stale / actives                                                  |
| Délai réponse médian          | Messaging                                                        |
| Rétention D7 owners / seekers | Cohortes — volume peut être insuffisant                          |
| Coûts ops                     | Budget                                                           |

---

## 6. Instrumentation manquante (travail requis)

| Gap                                        | Action                             |
| ------------------------------------------ | ---------------------------------- |
| Dépenses ads                               | Import manuel sheet → plus tard BI |
| Favoris legacy vs Nest                     | Aligner events                     |
| Visites PropertyVisit vs appointments Nest | Harmoniser funnel                  |
| Alertes notif délivrées                    | Providers réels                    |
| « Contact qualifié »                       | Définir règle + tag ops            |

Réutiliser tracking existant avant d’ajouter des événements redondants.

---

## 7. Vue « Launch war room » (hebdo)

1. Annonces actives vérifiées (par zone)
2. Zero-result rate
3. Contacts + réponse 48 h
4. Signalements ouverts
5. Top frictions support

Pas de vanity : inscriptions seules ≠ succès.
