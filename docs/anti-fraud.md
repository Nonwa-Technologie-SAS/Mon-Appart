# Antifraude immobilier

Les signaux sont stockés dans `TrustSignal` (pas de table `Fraud` séparée). Une alerte **n’est jamais une preuve** et **ne bloque pas automatiquement** un compte.

## Règles implémentées

| Code                                 | Déclencheur                                            | Sévérité | Effet                                |
| ------------------------------------ | ------------------------------------------------------ | -------- | ------------------------------------ |
| `DUPLICATE_DOCUMENT`                 | Même empreinte fichier sur un autre compte             | HIGH     | Revue                                |
| `RELATION_NOT_ESTABLISHED`           | Relation revendiquée absente                           | MEDIUM   | Revue                                |
| `CONFLICTING_OWNERSHIP`              | Autre propriétaire SOLE vérifié                        | HIGH     | Revue                                |
| `REPORT_THRESHOLD`                   | N déclarants distincts                                 | MEDIUM   | Priorisation                         |
| `PRICE_CHANGE_ANOMALY`               | Variation prix > ratio (défaut 50 %)                   | MEDIUM   | Revue                                |
| `REPORT_REVIEW_REQUESTED`            | Suite à signalement confirmé                           | HIGH     | Revue                                |
| `ACCOUNT_BURST_ACTIVITY`             | ≥ N annonces créées / fenêtre (défaut 8 / 24 h)        | MEDIUM   | Revue                                |
| `DUPLICATE_LISTING_SAME_PROPERTY`    | Autre annonce PUBLISHED même bien + type d'offre       | MEDIUM   | Revue                                |
| `DUPLICATE_MEDIA_CROSS_ACCOUNT`      | SHA-256 photo PROPERTY déjà envoyé par un autre compte | HIGH     | Revue                                |
| `MATERIAL_CHANGE_AFTER_VERIFICATION` | Champs notables après `LISTING_CONSISTENCY` VERIFIED   | MEDIUM   | Réévaluation, pas de révocation auto |
| `MESSAGE_CREDENTIAL_HARVEST`         | Message à risque identifiants (`message.safety_alert`) | HIGH     | Banner + revue                       |
| `MESSAGE_FAKE_SUPPORT`               | Usurpation du support (`message.safety_alert`)         | HIGH     | Banner + revue                       |

Évaluation relecteur : `listing-risk-v1` (LOW→CRITICAL). Un signal isolé ne bloque rien. Voir [property-risk-detection.md](./property-risk-detection.md) et [fraud-risk-rules-and-thresholds.md](./fraud-risk-rules-and-thresholds.md).

Configuration : `TRUST_*` dans `.env.example`.

## Revue humaine

- File : routes Trust admin (`verification:review` ou `report:review`).
- Statuts : `OPEN` → `CONFIRMED` / `DISMISSED` (pas de sanction auto).
- Décisions auditées ; notes internes non exposées au déclarant.

## Non implémenté (volontairement)

- ML / scoring prédictif sans données évaluées.
- Empreintes perceptuelles d’images (hors hash exact médias).
- Blocage automatique sur un signal isolé.
- Détection phishing NLP / ML. Des **règles déterministes** `message-safety-v1` produisent des avertissements ; un lien n’est jamais classé malveillant sans autre signal fiable.

## Limites

Un prix bas, une IP partagée ou plusieurs annonces légitimes d’une agence peuvent déclencher un signal. La décision reste humaine.
