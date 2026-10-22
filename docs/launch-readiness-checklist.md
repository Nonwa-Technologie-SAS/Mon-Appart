# Checklist préparation au lancement

Complète [production-readiness-checklist.md](./production-readiness-checklist.md) et [sre-operational-readiness-checklist.md](./sre-operational-readiness-checklist.md).

**B** = bloquant · **I** = important · **P** = post-lancement

| # | Item | Classe | Statut dépôt |
| --- | --- | --- | --- |
| 1 | Search + fiche annonce | B | Code OK — valider staging |
| 2 | Auth / récupération compte | B | Nest — valider e2e staging |
| 3 | Publish / gestion annonces | B | Espace Nest |
| 4 | Contact / demande visite | B | Présent |
| 5 | Modération minimale | I | Admin socle |
| 6 | Reco / assistant | P | Flags ; non bloquant |
| 7 | Notifications réelles | I | Config providers |
| 8 | Paiements | P | Mock only — **ne pas** activer live |
| 9 | SEO / pages publiques | I | Présent |
| 10 | Perf mobile | I | À mesurer |
| 11 | Sécu / données | B | Checklists sécu |
| 12 | Backups + restore test | B | Doc ; restore **non** fait |
| 13 | Monitoring / alertes | B | Code metrics ; canal externe manquant |
| 14 | Support / contacts | I | À définir |
| 15 | Mentions légales / CGU | B | Validation juridique **externe** |
| 16 | Rollback documenté | I | Runbooks |
| 17 | Intégrations externes | I | Selon env |

Une case cochée = **vérifiée**, pas « fichier existe ».
