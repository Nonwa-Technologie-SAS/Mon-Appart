# Checklist release

À cocher par release (adapter au risque).

## Avant

- [ ] Spec / ticket avec critères d’acceptation (si feature)
- [ ] CI verte sur le SHA
- [ ] Migrations relues ; expand/contract si besoin
- [ ] Snapshot/backup si migration risquée
- [ ] Flags / env documentés
- [ ] Plan rollback écrit
- [ ] Owner release identifié

## Staging

- [ ] `prisma migrate deploy`
- [ ] Déploiement même SHA
- [ ] `pnpm smoke:health` / `SMOKE_API_URL=…`
- [ ] Parcours : search, fiche, login, publish (si touché)
- [ ] Pas de spike erreurs logs

## Production

- [ ] Approbation environment GitHub
- [ ] Même artefact
- [ ] Smoke + surveillance 30–60 min
- [ ] Notes de version publiées
- [ ] Flag temporaire planifié pour retrait

## Stop

Échec CI, ready 503 durable, 5xx élevé, migration lockée → **pas de prod** / rollback.
