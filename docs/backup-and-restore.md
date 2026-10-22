# Sauvegardes et restauration

Voir aussi le détail Prompt 16 : [backup-and-disaster-recovery.md](./backup-and-disaster-recovery.md).

## Statut

| Élément | Statut |
| --- | --- |
| Stratégie documentée | Oui |
| Backups Cloud activés | **Non** (fournisseur non provisionné) |
| Restore testé | **Non exécuté** dans cette session |
| Scripts locaux dump | Non fournis (préférer outil managé) |

## RPO / RTO proposés (à valider)

- RPO ≤ 24 h (cible ≤ 1 h avec PITR)
- RTO ≤ 4 h

## Procédure restore (staging isolé uniquement)

1. Snapshot / backup sélectionné.
2. Restaurer sur instance **vide** hors production.
3. `CREATE EXTENSION postgis` si besoin ; `prisma migrate status`.
4. Démarrer API avec `DATABASE_URL` de lab ; `pnpm smoke:health`.
5. Compter listings / users vs export préalable.
6. Chronométrer → mettre à jour RTO réel.

**Interdit :** restore destructif sur production sans autorisation écrite.

## Médias / Redis

- R2/S3 : versioning ; cohérence via `media:orphans`.
- Redis : reconstructible ; pas une sauvegarde métier.
