# Gestion des incidents

Organisation **proportionnée** : pas d’astreinte 24/7 assumée. Adapter les contacts avant go-live.

## Sévérités

| Niveau | Critères | Premières actions | Communication |
| --- | --- | --- | --- |
| **SEV-1** | Plateforme largement down, perte de données en cours, compromission majeure | Mobiliser tous les rôles disponibles ; freeze déploiements ; préserver preuves | Message immédiat équipe + stakeholders |
| **SEV-2** | Parcours majeur cassé (auth, search, publish) | Owner technique + diagnostic runbook ; mitigation | Canal ops sous 30 min |
| **SEV-3** | Impact limité, contournement possible | Ticket + correctif planifié | Note async |
| **SEV-4** | Cosmétique / dette | Backlog | — |

## Cycle

1. **Détecter** (alerte, smoke, signal utilisateur).
2. **Déclarer** (sévérité, commander incident temporaire).
3. **Mitiger** (rollback, scale, mode dégradé) avant cause racine.
4. **Résoudre** (symptôme disparu + checks verts).
5. **Postmortem** sous 5 jours ouvrés pour SEV-1/2 ([template](./incident-postmortem-template.md)).

## Rôles (génériques)

- **Incident commander** : priorise, décide rollback.
- **Tech lead** : diagnostic / correctif.
- **Comms** : messages utilisateurs / partenaires si besoin.

Si une seule personne : combiner commander + tech ; documenter la limite.

## Escalade

- SEV-1 sans progrès 30 min → escalade hébergeur / DBA / sécurité selon symptôme.
- Fuite de secrets → [security-incident-response.md](./security-incident-response.md) + [operational-security.md](./operational-security.md).

## Critères de résolution

- `/health/ready` 200 (sauf maintenance).
- Parcours critiques smoke OK.
- Pas de croissance du backlog jobs critique.
- Décision explicite de clôture par le commander.
