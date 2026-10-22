# Estimation des coûts Cloud

**Les montants ci-dessous sont des ordres de grandeur indicatifs (2026), non des tarifs garantis.** Vérifier les pages pricing des fournisseurs avant engagement. Devise : USD / mois.

## Hypothèses phase 1 (lancement CI)

- Trafic : quelques milliers d’utilisateurs actifs / mois
- 1 région
- Recherche PostgreSQL (pas d’OpenSearch)
- Reco = rules (pas de service Python 24/7)
- Médias : dizaines de Go

## Fourchette Option A (recommandée)

| Poste | Fourchette basse | Fourchette haute | Notes |
| --- | --- | --- | --- |
| Vercel (web+admin) | 0–20 | 20–50 | Hobby → Pro |
| API + workers (Fly/Render) | 15–40 | 50–120 | 2–3 small VMs |
| Postgres PostGIS managé | 25–60 | 80–200 | Selon RAM/stockage/HA |
| Redis | 0–10 | 20–40 | Upstash free → payant |
| R2 / S3 + egress | 5–15 | 30–80 | Egress = variable |
| Cloudflare | 0–20 | 20 | Free → Pro |
| Monitoring (Sentry) | 0–26 | 26–80 | Free → Team |
| **Total indicatif** | **~50–150** | **~250–600** | |

## Coûts variables à surveiller

- Egress images (atténué par R2 + CDN)
- Builds CI minutes GitHub
- Stockage backups Postgres
- SMS / e-mail transactionnels
- OpenSearch (reporter tant que Postgres search suffit) : souvent **+50–200 USD/mois** dès un petit cluster

## Ce qu’il ne faut pas activer trop tôt

- Kubernetes managé (EKS/GKE/AKS) : coût fixe + ops
- Multi-région active-active
- OpenSearch « au cas où »
- Observabilité full-stack heavy (métriques haute cardinalité) sans rétention bornée

## Contrôles financiers

- Budgets + alertes chez le Cloud
- Tags `env=staging|production`
- Destruction automatique des previews coûteuses
- Revue mensuelle des invoices

Quand un fournisseur est choisi, remplacer ce tableau par une feuille chiffrée réelle (lien interne ops).
