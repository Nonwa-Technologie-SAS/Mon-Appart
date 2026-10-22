# Protection des données

Cadre technique pour Mon Appart (Côte d’Ivoire). **Aucune conformité légale n’est déclarée acquise** : validation ARTCI / conseil juridique requise avant production.

## Classification

| Classe | Exemples | Accès |
| --- | --- | --- |
| Publique | Annonces publiées, variantes images publiques | Ouvert |
| Interne | Notes de modération, motifs internes | Staff autorisé |
| Personnelle | E-mail, téléphone, nom | Propriétaire + permissions PII |
| Sensible / documentaire | Pièces d’identité, titres | Auteur + `verification:documents` |
| Auth | passwordHash, refresh hash, OTP hash | Jamais exposés |
| Financière | Commandes, transactions (pas de PAN) | Compte + billing admin |
| Antifraude | `TrustSignal.details`, score | Revue Trust ; jamais public |

Voir aussi `DataClass` / `NEVER_LOG_FIELDS` dans `apps/api/src/modules/security/data-protection/`.

## Minimisation

- Analytics : catalogue fermé, clés sensibles refusées.
- Logs : masquage mots de passe, tokens, OTP, signatures webhook.
- Recherche : pas de `$queryRawUnsafe` ; texte normalisé.

## Rétention (technique)

| Donnée | Mécanisme |
| --- | --- |
| OTP / reset expirés | `identity:purge-artifacts` / `IDENTITY_RETENTION_*` |
| Sessions révoquées / expirées | idem (jours configurables) |
| Analytics bruts | `ANALYTICS_RETENTION_DAYS` + worker |
| Médias orphelins | `media:cleanup` / `media:orphans` |
| Documents Trust | `TRUST_DOCUMENT_RETENTION_DAYS` + maintenance |
| Audit | conservation longue (obligation éventuelle) — ne pas purger sans conseil |

## Droits des personnes

Mécanismes produit (accès / rectification / export / suppression) : à brancher sur Identity + Admin avec vérification d’identité du demandeur. **Statut : partiel** (profil utilisateur) ; export/suppression complets **à faire**.

## Prototype web

`apps/web` utilise une base legacy distincte ; les politiques API Nest ne s’y appliquent pas automatiquement (blobs publics pour photos d’annonces).
