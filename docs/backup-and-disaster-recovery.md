# Sauvegardes et reprise après incident

**Statut :** procédures documentées. Les sauvegardes Cloud **ne sont pas activées** tant qu’aucun fournisseur n’est provisionné.

## Objectifs cibles (à valider métier)

| Indicateur | Cible initiale proposée | Note |
| --- | --- | --- |
| RPO | ≤ 24 h (idéalement ≤ 1 h avec PITR) | Dépend du plan Postgres managé |
| RTO | ≤ 4 h | Dépend du runbook et des tests |

Ces chiffres ne sont **pas garantis** tant qu’un test de restauration n’a pas été exécuté.

## PostgreSQL

Chez le fournisseur managé, activer :

- sauvegardes automatiques quotidiennes ;
- PITR si disponible ;
- chiffrement au repos ;
- rétention ≥ 7 jours (staging) / ≥ 14–30 jours (production) ;
- protection contre suppression accidentelle du cluster ;
- snapshot manuel avant migration destructive.

### Test de restauration (staging isolé)

1. Provisionner une instance vide.
2. Restaurer le dernier backup / PITR.
3. Vérifier : extension PostGIS, `prisma migrate status`, démarrage API, `/health/ready`.
4. Comparer compteurs clés (listings publiés, users actifs) avec un export préalable.
5. Documenter durée réelle → recalibrer RTO.

**Ne jamais** restaurer « par-dessus » la production sans plan de bascule.

## Médias (R2/S3)

- Versioning bucket + rétention minimale.
- Object Lock / MFA delete si le volume critique le justifie.
- Cohérence : métadonnées Postgres vs objets (job `media:orphans`).
- Les fichiers orphelins se nettoient ; les objets manquants se détectent via health métier / CLI.

## Redis

Considéré **reconstructible** (cache, rate-limit, files). Persistence AOF en local Compose uniquement pour le confort. En incident Redis : vider / recreer, accepter réchauffement cache et rejeu limité des jobs failed.

## OpenSearch

Index reconstructible via `search:reindex` depuis PostgreSQL. Pas de backup OpenSearch critique tant que Postgres est sain.

## Preuves

Conserver dans le runbook ops :

- date du dernier test de restauration ;
- durée mesurée ;
- responsable ;
- écarts vs RPO/RTO.
