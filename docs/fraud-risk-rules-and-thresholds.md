# Règles de risque et seuils

Document interne équipes autorisées. Ne pas recopier les motifs exacts de détection conversationnelle vers un canal public.

Les règles vivent dans `risk-rules.ts` et `message-safety.ts`. **Aucune ne sanctionne.** Désactivation : retirer l’écouteur ou le mapping n’est pas prévu par flag ; un bump de version (`listing-risk-v1`, `message-safety-v1`) et un déploiement sont requis. Les seuils numériques se configurent via `TRUST_*` (voir `.env.example`).

## Règles TrustSignal

| Code                                 | Sévérité | Seuil / condition                                | Action proposée     | Revue | Limites / faux positifs     |
| ------------------------------------ | -------- | ------------------------------------------------ | ------------------- | ----- | --------------------------- |
| `DUPLICATE_DOCUMENT`                 | HIGH     | Même SHA-256, autre compte                       | Examiner les pièces | Oui   | Même groupe d’agence        |
| `RELATION_NOT_ESTABLISHED`           | MEDIUM   | Relation absente                                 | Clarifier le mandat | Oui   | Dossier en cours d’ajout    |
| `CONFLICTING_OWNERSHIP`              | HIGH     | Autre SOLE vérifié                               | Instruction         | Oui   | Indivision mal saisie       |
| `REPORT_THRESHOLD`                   | MEDIUM   | `TRUST_REPORT_REVIEW_THRESHOLD` (défaut 3)       | Priorité HIGH       | Oui   | Brigading                   |
| `PRICE_CHANGE_ANOMALY`               | MEDIUM   | Ratio `TRUST_PRICE_ANOMALY_RATIO` (défaut 0,5)   | Revue du prix       | Oui   | Correction légitime         |
| `REPORT_REVIEW_REQUESTED`            | HIGH     | Mesure humaine                                   | Réexamen vérif.     | Oui   | —                           |
| `ACCOUNT_BURST_ACTIVITY`             | MEDIUM   | `TRUST_LISTING_BURST_THRESHOLD` / fenêtre heures | Revue du compte     | Oui   | Portefeuille agence         |
| `DUPLICATE_LISTING_SAME_PROPERTY`    | MEDIUM   | ≥ 1 autre PUBLISHED même bien+type               | Distinguer doublon  | Oui   | Multi-annonceurs autorisés  |
| `DUPLICATE_MEDIA_CROSS_ACCOUNT`      | HIGH     | Hash photo autre compte                          | Vérifier la source  | Oui   | Comptes collègues           |
| `MATERIAL_CHANGE_AFTER_VERIFICATION` | MEDIUM   | Champs notables                                  | Réévaluer           | Oui   | Correction de faute         |
| `MESSAGE_CREDENTIAL_HARVEST`         | HIGH     | Motifs d’identifiants                            | Banner + alerte     | Oui   | Faux positifs linguistiques |
| `MESSAGE_FAKE_SUPPORT`               | HIGH     | Usurpation support                               | Banner + alerte     | Oui   | Mention légitime du nom     |

## Conversations (`message-safety-v1`)

Codes utilisateur : `CREDENTIAL_HARVEST`, `FAKE_SUPPORT`, `PHISHING_LINK`, `PAYMENT_PRESSURE`, `OFF_PLATFORM`.

- Calculés **à la lecture**, pas stockés en base.
- Seuls les codes HIGH mappés Trust émettent `message.safety_alert` (règle + ids publics, **sans corps**).
- Un lien court isolé = MEDIUM, jamais une preuve de phishing.
- WhatsApp / canal externe = LOW, jamais une interdiction.

## Contestations

Décisions Listing / Trust existantes : le déclarant n’a pas d’appel produit dédié ; un nouveau signalement ou un nouveau dossier de vérification peut être ouvert selon les règles. Les décisions révisées se mesurent via `DISMISSED` après `CONFIRMED` n’existe pas sur le même dossier (décision finale) : on mesure plutôt les **rétablissements d’annonces** (Listing) et les signalements `DISMISSED`.
