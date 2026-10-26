# Seeds, fixtures et données de test

## Distinctions

| Type            | Où                                                                    | Prod ?                               |
| --------------- | --------------------------------------------------------------------- | ------------------------------------ |
| Référentiels    | `seed/reference-data.ts`                                              | Oui (`SEED_PROFILE=reference`)       |
| Démo locale     | `seed/development.ts` (owner/customer/agent `@demo.mon-appart.local`) | **Non**                              |
| Fixtures tests  | `apps/api/test/**`                                                    | Non                                  |
| Données réelles | Bases staging/prod hébergées                                          | Uniquement là                        |
| Anonymisation   | **Non implémentée**                                                   | Ne pas copier la prod vers un laptop |

## Comportement réel

`apps/api/prisma/seed.ts` :

- Défaut local : `development` si la base n’est pas `*_test` et pas production-like.
- Test / staging / production : `reference`.
- `SEED_PROFILE=development` + `APP_ENV` staging/production → exception.

Idempotence : le seed **ajoute** rôles/permissions manquants, n’en retire pas.

Mot de passe démo : documenté dans `docs/web-nest-cutover.md`, **uniquement** local. Ce n’est pas un secret de production ; le renouveler s’il a fuité avec un `.env` réel.

## Tests

- Unitaires : pas de Postgres.
- Intégration : `mon_appart_test`, scripts `test-database.ts`.
- E2E API : app Nest de test.
- E2E web Playwright : local, pas en CI (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`).

## Staging

Préférer le référentiel + jeux **synthétiques**. Une copie prod exigerait une procédure d’anonymisation **écrite, autorisée et absente aujourd’hui**. Risque résiduel : ré-identification géographique (communes).
