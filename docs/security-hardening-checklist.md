# Checklist de durcissement — avant production

## Domaine & TLS

- [ ] HTTPS uniquement ; redirection HTTP → HTTPS
- [ ] Une variante canonique (www / apex)
- [ ] `TRUST_PROXY` aligné sur le reverse proxy réel

## Secrets

- [ ] Tous les secrets régénérés (pas les valeurs `.env.example`)
- [ ] `METRICS_ENABLED=true` ⇒ `METRICS_SCRAPE_TOKEN` ≥ 32 chars, scrape authentifié
- [ ] Aucun secret dans `NEXT_PUBLIC_*`
- [ ] Gestionnaire de secrets / CI secrets (pas de fichier `.env` sur le serveur partagé)

## Identity

- [ ] Fournisseurs e-mail/SMS **réels** (pas `DevNotificationProvider`)
- [ ] `AUTH_DEV_PRINT_CODES=false`
- [ ] Cron / worker : `identity:purge-artifacts` ou `IDENTITY_RETENTION_INTERVAL_MINUTES` > 0
- [ ] MFA staff (quand disponible) — aujourd’hui **planifié seulement**

## API

- [ ] Swagger désactivé en prod
- [ ] CORS = origines explicites (pas `*`)
- [ ] Antivirus documents branché (aujourd’hui `NoopDocumentScanner`)
- [ ] Prestataire paiement réel + secrets webhook + tests sandbox

## Frontends

- [ ] Headers CSP/HSTS vérifiés sur web et admin
- [ ] Préprod : noindex + accès restreint
- [ ] Admin : pas de compte seed avec mot de passe connu

## Observabilité & conformité

- [ ] Search Console / monitoring sans exposer `/metrics` publiquement
- [ ] Revue juridique ARTCI / politique de confidentialité
- [ ] Plan d’incident contacté et testé (tabletop)

## Tests

```bash
pnpm --filter @mon-appart/config test
pnpm --filter @mon-appart/api test
pnpm --filter @mon-appart/api test:db   # si base _test disponible
```
