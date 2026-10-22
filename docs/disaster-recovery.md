# Reprise après sinistre (DR)

## Scénarios

| Scénario | Impact | Réponse |
| --- | --- | --- |
| Région compute down | API/workers KO | Redeploy autre région / provider ; DNS |
| Postgres corrompu / perdu | Données métier | Restore backup → verify → bascule DNS DB |
| Bucket médias perdu | Images KO | Restore versioning / réplique ; métadonnées PG intactes |
| Redis perdu | Cache/files | Recréer ; cold start ; requeue jobs si besoin |
| Compromission secrets | Sécurité | Rotation + [operational-security](./operational-security.md) |

## Ordre de reprise typique

1. Sécuriser accès (secrets, IAM).
2. Restaurer Postgres (source de vérité).
3. Vérifier migrations / PostGIS.
4. Redis neuf.
5. API + workers (SHA connu).
6. Web/admin.
7. Search reindex si nécessaire.
8. Smoke + parcours critiques.
9. Communication utilisateurs.

## Dépendances croisées

Annonces = lignes PG + objets R2. Un restore PG ancien + bucket actuel → orphelins / 404 images. Documenter le couple (timestamp backup PG ↔ version bucket).

## Exercices

Planifier un game day semestriel sur staging. Résultats dans le runbook ops (date, durée, écarts RTO).
