# Exports et rapports BI

## État actuel

**Aucun export CSV/XLSX BI n’est livré** dans cette phase. Les dashboards consomment les JSON des endpoints Analytics / Billing. Pas d’envoi automatique d’e-mails de rapports (le module notifications n’est pas branché à un job BI).

## Règles à respecter lors de l’implémentation

1. Mêmes permissions que le dashboard source (`analytics:admin`, ownership éditeur, `billing:read`).
2. Mêmes filtres `from` / `to` / dimensions que l’API.
3. Colonnes minimales ; pas d’e-mail, téléphone ni message.
4. Échapper les cellules tableur (`=`, `+`, `-`, `@`) pour limiter l’injection de formules.
5. Limiter volume et fréquence ; journaliser l’export dans l’audit admin si sensible.
6. Génération asynchrone si fichier volumineux ; notification via le module existant uniquement s’il est configuré.

## Alternative immédiate

Copie manuelle des chiffres affichés ou consommation API par un outil interne autorisé — sans contourner les permissions.
