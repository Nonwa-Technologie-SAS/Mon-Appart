# Indicateurs Trust & Safety

Les volumes de signalements **ne mesurent pas** la fraude réelle. Dénominateur et période à indiquer à chaque publication interne.

Période recommandée : 7 jours et 30 jours, fuseau Africa/Abidjan.

| Indicateur                         | Définition                                                | Dénominateur                   | Source                |
| ---------------------------------- | --------------------------------------------------------- | ------------------------------ | --------------------- |
| Signalements reçus                 | `Report` créés                                            | —                              | `reports.created_at`  |
| Par motif                          | groupé `reason`                                           | reçus                          | idem                  |
| Délai médian 1re prise en charge   | `IN_REVIEW` ou assignation − création                     | dossiers pris                  | `report_events`       |
| Délai médian de clôture            | `resolved_at` − création                                  | dossiers clos                  | `reports`             |
| Part fondés                        | `CONFIRMED`                                               | clos (`CONFIRMED`+`DISMISSED`) | `reports.status`      |
| Part écartés                       | `DISMISSED`                                               | clos                           | idem                  |
| Annonces suspendues puis rétablies | transitions Listing SUSPENDED → PUBLISHED                 | suspendues dans la période     | événements Listing    |
| Faux positifs estimés              | `DISMISSED` + rétablissements après suspension liée       | dossiers examinés              | pas un taux de fraude |
| Récidive                           | compte avec ≥ 2 `TrustSignal` CONFIRMED distincts / 90 j  | comptes avec ≥ 1 confirmé      | `trust_signals`       |
| Vérification supplémentaire        | dossiers `NEEDS_MORE_INFORMATION`                         | dossiers soumis                | `verifications`       |
| Incidents critiques                | alertes HIGH confirmées harvest / fake-support            | —                              | `trust_signals`       |
| Décisions révisées                 | rétablissement Listing ou nouveau dossier après `REVOKED` | décisions préjudiciables       | Listing + Trust       |

Événements analytics existants : `TrustEvent.REPORT_CREATED` (et autres Trust). Ne pas envoyer le corps des messages. N’entraîner aucun modèle sur des signalements non examinés.

Le niveau `listing-risk-v1` n’est pas un KPI public.
