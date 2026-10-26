# Gouvernance des changements techniques

Légère, proportionnée au risque. ADR dans `docs/decisions/` ([index](./architecture-decision-records.md)).

## Quand un ADR

Hébergeur, auth, paiement, moteur de recherche, cache, bus (Kafka), découpage microservices, modèle immobilier majeur, framework, déploiement. Pas pour un correctif local.

Template : contexte, options, décision, raisons, conséquences +/–, alternatives, date, statut, conditions de réévaluation.

## Classification

| Niveau       | Exemples                                               | Contrôles                                                                             |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Mineur       | Typo, refactor interne                                 | CI PR, 1 revue si branche protégée                                                    |
| Significatif | Module, schéma additif, API, dépendance                | Revue, tests DB, doc, plan migrate                                                    |
| Critique     | Auth, paiements, permissions, PII, drop colonne, infra | Revue senior, ADR si structurant, staging, rollback écrit, pas de merge sans CI verte |

## Pull requests

Modèle : `.github/pull_request_template.md`. Conventional commits (`commitlint` + husky `commit-msg`).

Branches observées dans CI : `main`, `develop`. Protections GitHub **à activer** sur le distant (reviews + checks).

## Dépendances

Avant d’ajouter un package :

1. Existe-t-il déjà dans le monorepo ?
2. Maintenance, CVE, licence, coût bundle, ops.
3. Lockfile `pnpm-lock.yaml` uniquement (`--frozen-lockfile` en CI).
4. Majeur : PR isolée, changelog lu.
5. Dependabot : `.github/dependabot.yml` (npm hebdo, Actions hebdo, pip reco mensuel).

Runtimes : Node ≥ 22, pnpm `10.27.0` (`packageManager`). Python 3.12 pour la reco. Pas de Yarn/npm comme package manager du monorepo.

Ne pas remplacer un outil **déjà en place** pour suivre une mode (pas de nouveau bus, pas de Vault tant que GitHub Environment + hébergeur suffisent).
