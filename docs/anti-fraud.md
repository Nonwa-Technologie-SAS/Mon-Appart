# Antifraude immobilier

Les signaux sont stockés dans `TrustSignal` (pas de table `Fraud` séparée). Une alerte **n’est jamais une preuve** et **ne bloque pas automatiquement** un compte.

## Règles implémentées

| Code | Déclencheur | Sévérité | Effet |
| --- | --- | --- | --- |
| `DUPLICATE_DOCUMENT` | Même empreinte fichier sur un autre compte | HIGH | Revue |
| `RELATION_NOT_ESTABLISHED` | Relation revendiquée absente | MEDIUM | Revue |
| `CONFLICTING_OWNERSHIP` | Autre propriétaire SOLE vérifié | HIGH | Revue |
| `REPORT_THRESHOLD` | N déclarants distincts | MEDIUM | Priorisation |
| `PRICE_CHANGE_ANOMALY` | Variation prix > ratio (défaut 50 %) | MEDIUM | Revue |
| `REPORT_REVIEW_REQUESTED` | Suite à signalement confirmé | HIGH | Revue |
| `ACCOUNT_BURST_ACTIVITY` | ≥ N annonces créées / fenêtre (défaut 8 / 24 h) | MEDIUM | Revue |

Configuration : `TRUST_*` dans `.env.example`.

## Revue humaine

- File : routes Trust admin (`verification:review` ou `report:review`).
- Statuts : `OPEN` → `CONFIRMED` / `DISMISSED` (pas de sanction auto).
- Décisions auditées ; notes internes non exposées au déclarant.

## Non implémenté (volontairement)

- ML / scoring prédictif sans données évaluées.
- Empreintes perceptuelles d’images (hors hash exact médias).
- Blocage automatique sur un signal isolé.
- Détection phishing NLP dans les messages.

## Limites

Un prix bas, une IP partagée ou plusieurs annonces légitimes d’une agence peuvent déclencher un signal. La décision reste humaine.
