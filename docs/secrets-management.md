# Gestion des secrets

Aucun secret réel n’appartient à ce document.

## Classification

| Classe       | Exemples                                                               | Stockage cible                             |
| ------------ | ---------------------------------------------------------------------- | ------------------------------------------ |
| Critique     | `DATABASE_URL`, `JWT_*`, clés S3, SMTP, SMS, OpenAI, scrape Prometheus | Runtime / GitHub Environment, pas le dépôt |
| Opérationnel | `SENTRY_DSN` (DSN public-ish), tokens CI non prod                      | Idem, périmètre plus large                 |
| Public       | `NEXT_PUBLIC_*`, URL site                                              | Dépôt / bundle                             |

## Stockage réel

| Contexte                 | Mécanisme **observé**                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Local                    | `.env` (désormais gitignoré)                                                                                                        |
| CI PR                    | Placeholders dans `ci.yml` (JWT de test uniquement)                                                                                 |
| Staging / prod           | **Prévu** : GitHub Environments + variables de l’hébergeur. Aucun secret cloud n’est configuré dans ce dépôt (`deploy-staging.yml`) |
| Vault / AWS SM / Doppler | **Non déployé** — ne pas en ajouter tant que l’hébergeur n’existe pas                                                               |

Pas de Docker secrets Compose. L’image API ne copie pas `.env` (build ARG `DATABASE_URL` factice pour `prisma generate` seulement).

## Fichiers locaux

- `.gitignore` ignore `.env` / `.env.*`, conserve `.env.example`.
- `pnpm secrets:check` / job CI `secrets` : aucun `.env` suivi.
- `pnpm secrets:local` : génère des JWT locaux, n’écrit pas de fichier.
- Husky : lint-staged (formatage), pas un scanner local.

## Rotation (procédure, non exécutée ici)

1. Générer la nouvelle valeur hors dépôt.
2. L’injecter sur l’environnement **cible uniquement**.
3. Redéployer ou recréer les processus.
4. Vérifier login / webhooks / médias.
5. Révoquer l’ancienne valeur.

| Secret               | Impact                                 | Transition                                                   |
| -------------------- | -------------------------------------- | ------------------------------------------------------------ |
| `JWT_SECRET`         | Access tokens invalides                | Reconnexion. **Pas** de double clé aujourd’hui               |
| `JWT_REFRESH_SECRET` | Refresh, OTP, reset invalides          | Idem                                                         |
| PostgreSQL           | Coupure API                            | Fenêtre, URL directe pour migrate                            |
| Redis                | Cache / sessions volatiles selon usage | TTL court                                                    |
| S3/R2                | Uploads                                | Deux clés le temps de la bascule si le fournisseur le permet |
| Paiement             | N/A : seul `mock` / `none` existent    |

Ne pas révoquer une clé de production sans autorisation.

## Détection

- Job CI `secrets` : `assert-no-tracked-env.mjs` + Gitleaks (`--no-git`, `.gitleaks.toml`).
- Scan **d’historique** Git non activé : des `.env` ont déjà été commités (voir remédiation).
- Activer GitHub Secret scanning + push protection sur le dépôt distant.

## Remédiation si fuite

1. Révoquer / renouveler **immédiatement** (le retirer du dernier commit ne suffit pas).
2. Ne pas réécrire l’historique sans décision explicite.
3. Auditer les accès (GitHub, registry, base).
4. Noter l’incident ([security-incident-response.md](./security-incident-response.md) si applicable).
