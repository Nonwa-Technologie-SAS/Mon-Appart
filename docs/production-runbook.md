# Runbook production

## Démarrage / arrêt

### API (conteneur)

```bash
# Après inject des secrets + DATABASE_URL / REDIS_URL
docker run --rm -p 4000:4000 --env-file .env.production mon-appart-api:<sha>
# Health
curl -fsS "$API/health/live"
curl -fsS "$API/health/ready"
```

### Migrations (one-shot, URL directe Postgres)

```bash
pnpm --filter @mon-appart/api db:migrate   # prisma migrate deploy
```

Exécuter **une seule** instance de migration à la fois.

### Workers

```bash
docker run --rm --env-file .env.production mon-appart-workers:<sha>
```

## Déploiement nominal

1. CI verte sur le commit.
2. Image taguée du **même** SHA.
3. Backup / snapshot si migration non triviale.
4. `migrate deploy` sur staging puis production.
5. Rollout API (rolling) → workers.
6. Déploiement Vercel web/admin (env `NEST_API_URL` / rewrites).
7. `node scripts/smoke-health.mjs`.
8. Parcours manuels : login, search, fiche annonce, publish (éditeur).

## Rollback applicatif

1. Redéployer l’image / déploiement Vercel du SHA précédent.
2. Vérifier compatibilité schéma : si migration expand déjà appliquée, l’ancien code doit rester compatible ; sinon **pas** de rollback DB automatique — forward-fix.
3. Purger caches Redis si symptômes de données périmées.
4. Rejouer / inspecter jobs failed BullMQ.

## Incident — ready down

1. `GET /health` → quelle dépendance ?
2. Postgres : connexions, failover fournisseur.
3. Redis : ping, bascule.
4. Ne pas redémarrer en boucle sur liveness si seule une dépendance externe est down.

## Contacts

À renseigner avant go-live : propriétaire produit, on-call technique, hébergeur support, prestataire paiement/SMS.

Voir aussi [security-incident-response.md](./security-incident-response.md).
