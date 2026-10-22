# Sécurité opérationnelle

Complète [security.md](./security.md) et [security-incident-response.md](./security-incident-response.md).

## Contrôles présents dans le dépôt

| Contrôle | Statut |
| --- | --- |
| Redaction logs Pino | Implémenté |
| `/metrics` derrière Bearer | Implémenté (si activé) |
| Health sans secrets | Implémenté |
| Seed/test DB anti-prod | Implémenté |
| Mock paiement refusé staging/prod | Implémenté |
| Secrets dans Git | Interdit (`.gitignore`, `.env.example` sans secrets) |

## À configurer chez le fournisseur

- Accès scrape métriques réseau privé / VPN.
- IAM least privilege (API → DB/R2/Redis).
- Rotation JWT / DB / R2.
- MFA comptes cloud.
- Encryption backups.
- Pas d’exposition publique Postgres/Redis.

## Fuite de secrets suspectée

1. Révoquer / rotater immédiatement.
2. Invalider sessions (`JWT_REFRESH_SECRET` change = logout global).
3. Auditer logs d’accès.
4. Postmortem SEV-1/2 sécurité.
5. Ne pas committer la clé « pour debug ».

## Alertes

Ne pas inclure PII (e-mail, téléphone, contenu message) dans les notifications d’alerte.
