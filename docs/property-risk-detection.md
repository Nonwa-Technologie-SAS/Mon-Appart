# Détection de risque des annonces

Moteur `listing-risk-v1` dans `apps/api/src/modules/trust/domain/listing-risk.ts`. Réservé aux relecteurs (fiche signalement). **Jamais exposé comme statut public.**

## Entrées

- Alertes `TrustSignal` ouvertes liées à l’annonce.
- Nombre de déclarants distincts encore ouverts.
- Nombre d’alertes **confirmées** par un humain (`CONFIRMED`).

## Sorties

| Niveau   | Action recommandée                                   | Revue humaine |
| -------- | ---------------------------------------------------- | ------------- |
| LOW      | MONITOR                                              | Non           |
| MODERATE | REVIEW                                               | Oui           |
| HIGH     | HOLD (mettre en attente une action sensible)         | Oui           |
| CRITICAL | PROTECT (mesure proportionnée via workflow existant) | Oui           |

Règle d’or : `isolatedSignalBlocksNothing` — un seul signal, même HIGH, n’autorise aucune sanction automatique.

## Signaux d’annonce

| Règle                                | Déclencheur                                                   | Limite                                                                   |
| ------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `DUPLICATE_LISTING_SAME_PROPERTY`    | Autre annonce **PUBLISHED** même `propertyId` + `listingType` | Une agence peut publier plusieurs offres légitimes ; similarité ≠ fusion |
| `DUPLICATE_MEDIA_CROSS_ACCOUNT`      | SHA-256 PROPERTY déjà envoyé par un **autre** compte          | Faux positifs intra-réseau d’agence si comptes distincts                 |
| `MATERIAL_CHANGE_AFTER_VERIFICATION` | Champs notables après `LISTING_CONSISTENCY` VERIFIED          | `expiresAt` n’est pas notable ; pas de révocation auto                   |
| `PRICE_CHANGE_ANOMALY`               | Variation > ratio configuré                                   | Pas de prix de marché inventé                                            |
| `ACCOUNT_BURST_ACTIVITY`             | N créations / fenêtre                                         | Revue, pas de plafond dur                                                |
| `REPORT_THRESHOLD`                   | N déclarants distincts                                        | Priorité d’examen seulement                                              |

Pas de contrôle statistique de « prix hors marché » : les comparables locaux ne sont pas assez fiables dans le dépôt. Le signal prix se limite à une **variation** sur la même annonce.

## Doublons — distinctions

1. Même bien, même responsable, même type d’offre → alerte de revue.
2. Location et vente du même bien → types d’offre différents, pas ce signal.
3. Photos similaires perceptuellement → **non implémenté** (hash exact seulement).
4. Tentative frauduleuse vs catalogue d’agence → décision humaine.

## Version

Le champ `version: listing-risk-v1` voyage avec l’évaluation. Un changement de seuils exige un bump de version et une entrée dans [fraud-risk-rules-and-thresholds.md](./fraud-risk-rules-and-thresholds.md).
