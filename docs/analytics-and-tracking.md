# Analytics et suivi d'usage

Mesure d'audience et indicateurs produit de Mon Appart : ce qui est collecté, comment, sur quelle base, et ce qui est publié. Décision d'architecture : [0011](./decisions/0011-analytics-architecture.md).

**Business Intelligence (dashboards décisionnels)** — architecture, catalogue, accès, qualité : [bi-data-architecture.md](./bi-data-architecture.md), [bi-metrics-catalog.md](./bi-metrics-catalog.md), [bi-dashboard-access-control.md](./bi-dashboard-access-control.md), [bi-data-quality.md](./bi-data-quality.md), [bi-performance-and-refresh.md](./bi-performance-and-refresh.md), [bi-exports-and-reports.md](./bi-exports-and-reports.md), [bi-testing-and-validation.md](./bi-testing-and-validation.md).

**Growth** — stratégie, attribution UTM, funnels : [growth-engineering-strategy.md](./growth-engineering-strategy.md), [growth-events-and-attribution.md](./growth-events-and-attribution.md), [growth-metrics-and-funnels.md](./growth-metrics-and-funnels.md).

## Principes

- **Deux sources, deux bases légales.**
  - Navigation (web, mobile) : envoyée par le client, **acceptée seulement avec le consentement analytique** (`basis = CONSENT`).
  - Faits métier (inscription, publication, contact, visite, lead…) : produits **par le backend, après l'action réelle**, à partir des événements de domaine (`basis = LEGITIMATE_INTEREST`, données pseudonymisées). Cette base légale est **à valider juridiquement** (ARTCI) avant la production.
- **Le client ne déclare jamais un fait métier.** Les événements `origin: server` envoyés par un client sont refusés (`server_only_event`). Un clic sur « Contacter » (`listing_contact_started`) n'est jamais un lead.
- **Catalogue fermé.** Noms, versions et propriétés autorisées sont définis dans `packages/analytics/src/catalog.ts` (schémas zod stricts). Toute propriété inconnue rejette l'événement.
- **Jamais de donnée sensible.** Clés interdites (mot de passe, token, OTP, e-mail, téléphone, message, adresse, coordonnées, URL, IP, pièces…) refusées à la validation ; les valeurs sont typées (codes, compteurs, identifiants publics). Pas d'URL : une **route normalisée** (`/annonces/[id]`), sans segment numérique ni identifiant. Pas de contenu de message, pas de texte de recherche, pas d'élément de vérification.
- **Pas de pistage fin ni de fingerprinting.** Ni mouvement de souris, ni frappe, ni position du curseur ; aucun identifiant dérivé du navigateur. L'identifiant anonyme est un UUID aléatoire, créé seulement après consentement, renouvelé tous les 30 jours, jamais rapproché du compte.
- **Analytics ne bloque rien.** L'écouteur est asynchrone et `AnalyticsTracker.track` n'échoue jamais (compteur `analytics_tracking_failures_total` et log `analytics.track_failed`). Aucun module métier ne dépend d'Analytics.
- **Distinct de l'audit.** `audit_logs` reste la trace de sécurité (seuls les changements de consentement y sont écrits). `user_events` est une **table héritée**, non alimentée par ce module.

## Architecture

```
web / Expo ──(lots, consentement)──▶ POST /api/v1/analytics/events ─┐
                                                                     ├─▶ analytics_events (brut, 13 mois)
modules métier ─(événements de domaine)─▶ BusinessEventListener ────┘          │
                                                                               ▼
                               AnalyticsWorker (dans l'API, toutes les 15 min) / CLI
                               ├─ agrégation journalière rejouable ─▶ analytics_daily_metrics
                               │                                     analytics_listing_daily
                               └─ purge au-delà de la rétention
                                                                               ▼
                               GET /api/v1/analytics/... et /api/v1/admin/analytics/... (agrégats seuls)
```

| Élément                 | Emplacement                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Catalogue et validation | `packages/analytics` (`catalog.ts`, `validation.ts`)                                |
| Client de suivi         | `packages/analytics/src/client.ts` (web et Expo)                                    |
| Ingestion               | `application/ingestion.service.ts`                                                  |
| Consentement            | `application/consent.service.ts`                                                    |
| Instrumentation métier  | `application/business-event.listener.ts`, `application/analytics-tracker.ts`        |
| Agrégation, purge       | `application/aggregation.service.ts`, `retention.service.ts`, `analytics-worker.ts` |
| Lecture                 | `application/analytics-query.service.ts`                                            |
| CLI                     | `cli/analytics-cli.ts`                                                              |

(chemins relatifs à `apps/api/src/modules/analytics/` sauf mention contraire)

Le worker tourne dans l'API comme ceux de Media et Notifications : pas de Redis ni de file. Plusieurs instances sont sûres (verrou consultatif PostgreSQL par jour, purge idempotente).

## Tables

Migrations `20261013090000_analytics` et `20261013093000_analytics_updated_at`.

| Table                       | Rôle                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `analytics_events`          | Événements bruts validés. `event_id` unique (idempotence), `properties` JSONB ≤ 4 Ko, base légale, source. |
| `analytics_daily_metrics`   | Agrégats journaliers `(day, metric, dimension, value)` : `count` et `actors` (acteurs distincts du jour).  |
| `analytics_listing_daily`   | Compteurs par annonce et par jour, sans aucun identifiant de visiteur.                                     |
| `analytics_ingestion_stats` | Acceptés, doublons, rejetés et ignorés par jour, source et motif (qualité des données).                    |
| `analytics_checkpoints`     | État des tâches (dernier jour clos, dernier succès, dernière erreur, durée).                               |
| `analytics_consents`        | Consentement analytique d'un compte (statut, version de politique, source).                                |

Contraintes en base : nom en snake_case, version 1 à 100, `properties` objet de 4 Ko au plus, `policy_version` obligatoire pour `CONSENT`, `anonymous_id` interdit hors `CONSENT`, compteurs positifs.

Index : `(name, occurred_at)`, `(listing_id, occurred_at)` et `(user_id, occurred_at)` partiels, `anonymous_id` partiel, BRIN sur `occurred_at`. **Aucun index sur `properties`** : les lectures passent par les agrégats.

La table n'est pas partitionnée : la purge supprime par lots de 5 000. Le partitionnement mensuel par `occurred_at` (purge par `DROP PARTITION`) sera justifié au-delà de quelques dizaines de millions de lignes.

## Catalogue d'événements

44 événements en version 1 (`EVENTS` dans `catalog.ts`). Statut d'instrumentation :

| Catégorie           | Événements                                                                                                                                                                                                                                                                                                                                                              | Émetteur                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Navigation (client) | `app_opened`, `page_viewed`, `search_results_viewed`, `search_filter_changed`, `search_sort_changed`, `search_suggestion_selected`, `map_results_viewed`, `listing_card_viewed`, `listing_detail_viewed`, `listing_gallery_interacted`, `listing_shared`, `listing_contact_started`, `listing_creation_started`, `recommendations_viewed`, `recommended_listing_opened` | Client de suivi (pas encore branché sur les frontends) |
| Recherche           | `search_submitted` (codes de filtres, commune, types, tranche de budget, nombre de résultats ; jamais le texte)                                                                                                                                                                                                                                                         | Backend, recherche validée (`submit=true`)             |
| Annonces            | `listing_creation_completed`, `listing_updated` (noms de champs), `listing_published`, `listing_paused`, `listing_expired`, `listing_marked_as_rented`, `listing_marked_as_sold`                                                                                                                                                                                        | Backend                                                |
| Compte              | `registration_completed`, `email_verification_completed`, `phone_verification_completed`                                                                                                                                                                                                                                                                                | Backend                                                |
| Contact et visites  | `conversation_created`, `listing_contact_submitted`, `message_sent` (côté, type, pièces ; jamais le contenu), `message_reply_received` (délai), `appointment_requested`, `appointment_confirmed`, `appointment_cancelled`, `appointment_completed`, `qualified_lead_recorded`                                                                                           | Backend                                                |
| Recommandation      | `recommendations_requested` (génération), `recommendation_dismissed`, `recommendation_feedback_submitted`, `recommendation_converted`                                                                                                                                                                                                                                   | Backend                                                |
| Confiance           | `listing_report_submitted` (motif codé)                                                                                                                                                                                                                                                                                                                                 | Backend                                                |
| Non instrumentés    | `listing_favorited`, `listing_unfavorited` (pas d'API favoris), `profile_completed`, `owner_onboarding_completed` (règle métier non définie)                                                                                                                                                                                                                            | Aucun (`instrumented: false`)                          |

Évolution du catalogue : une nouvelle version d'un événement incrémente `version` ; l'ancienne reste acceptée via `legacy` le temps que les clients se mettent à jour. Les noms ne sont jamais réutilisés.

### Lead qualifié

Une conversation devient lead qualifié **une seule fois** (`event_id` déterministe par conversation), selon `ANALYTICS_QUALIFIED_LEAD_RULE` :

- `REPLY` : première réponse du côté annonce ;
- `APPOINTMENT` : demande de visite liée à la conversation ;
- `REPLY_OR_APPOINTMENT` (défaut) : le premier des deux.

### Attribution aux recommandations

`recommendation_converted` est émis quand un contact ou une demande de visite porte sur une annonce ouverte depuis une recommandation (`recommended_listing_opened`, donc consentie) par le même compte, dans `ANALYTICS_ATTRIBUTION_HOURS` (72 h). Dernier clic, une conversion par (type, entité).

## Collecte côté client

`POST /api/v1/analytics/events` (authentification facultative, 202) :

```json
{
  "context": {
    "source": "web",
    "anonymousId": "uuid aléatoire (consentement donné)",
    "sessionId": "uuid de visite",
    "appVersion": "1.4.0",
    "consent": { "analytics": true, "policyVersion": "2026-10" },
    "sentAt": "2026-10-13T09:00:00.000Z"
  },
  "events": [
    {
      "eventId": "uuid",
      "name": "listing_detail_viewed",
      "schemaVersion": 1,
      "occurredAt": "2026-10-13T08:59:58.000Z",
      "properties": { "listingId": "uuid", "source": "SEARCH" }
    }
  ]
}
```

Réponse : `{ accepted, duplicates, ignored, rejected: [{ index, eventId, reason }] }`.

- Lot de 100 événements au plus, corps limité à 100 Ko (limite Express par défaut), 60 lots par minute et par IP (`ANALYTICS_RATE_LIMIT`).
- Structure invalide (champ de contexte inconnu, lot vide ou trop gros) : **400**, rien n'est écrit.
- Rejet par événement : `unknown_event`, `server_only_event`, `unsupported_version`, `forbidden_property`, `properties_too_large`, `invalid_properties`, `out_of_window`. Ne pas renvoyer un événement rejeté.
- Ignoré (valide mais non conservé) : collecte désactivée, consentement absent ou d'une ancienne politique, compte connecté sans consentement enregistré, annonce non publiée ou supprimée, annonce gérée par l'émetteur (un gestionnaire ne gonfle pas ses propres statistiques).
- Horodatage : corrigé du décalage d'horloge (`sentAt` / réception), refusé au-delà de 72 h (`ANALYTICS_MAX_EVENT_AGE_HOURS`) ou de 5 min dans le futur.
- Idempotence : renvoyer le même `eventId` ne crée pas de doublon (`duplicates`).

### Client `@mon-appart/analytics`

`new Tracker({ source, policyVersion, transport: createFetchTransport(endpoint), storage, appVersion })` (`storage` : `localStorage` sur le web, AsyncStorage sur Expo) :

- ne fait rien avant `setConsent(true)` ; `setConsent(false)` vide la file et efface l'identifiant anonyme stocké ;
- file bornée (200), envoi par lots (`flush`), reprise avec le même `eventId` et délai croissant, abandon après le nombre maximal d'essais ou sur un 4xx (`onDrop` signale chaque abandon) ;
- anti-doublon par type d'événement (`dedupWindowsMs`, par exemple une fiche comptée une fois par demi-heure et par appareil) ;
- refuse localement les événements serveur et les noms inconnus.

**Web** : branché via `AnalyticsProvider` + bannière de consentement (`apps/web/components/site/analytics-provider.tsx`). Choix anonyme en localStorage (`mon-appart:analytics:consent:v1`) ; comptes Nest peuvent aussi utiliser `PUT /analytics/consent`. **Mobile Expo** : pas encore branché. Sans `NEXT_PUBLIC_NEST_API_URL`, le tracker web reste inactif.

## Consentement

- `GET /api/v1/analytics/consent` : `UNSET`, `GRANTED` ou `DENIED`, avec la version courante. Un accord donné pour une ancienne politique vaut `UNSET`.
- `PUT /api/v1/analytics/consent` `{ granted, policyVersion, source }` : accorder exige la version courante (sinon 422 `CONSENT_POLICY_MISMATCH`). **Le retrait supprime immédiatement les événements de navigation du compte.** Chaque changement est audité (`ANALYTICS_CONSENT_GRANTED`, `ANALYTICS_CONSENT_WITHDRAWN`).
- Distinct des CGU et du consentement marketing.
- Anonyme : le choix est déclaré dans chaque lot ; sans accord, rien n'est conservé.
- Changer `ANALYTICS_POLICY_VERSION` invalide tous les consentements existants.

## Agrégation

Calcul journalier (UTC), par jour complet : suppression puis réinsertion dans une transaction, donc **rejouable et idempotent**. Le worker recalcule les `ANALYTICS_LATE_DAYS` (3) derniers jours clos et la journée en cours, au plus 31 jours par passage. Un jour antérieur à la rétention n'est jamais recalculé (ses événements bruts ont été purgés).

| Indicateur                            | Source                                        | Définition                                                                                                                                           |
| ------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `event.<nom>` (total, par plateforme) | `analytics_events`                            | Nombre d'événements, acteurs distincts du jour.                                                                                                      |
| `funnel` (étapes 1 à 8)               | `analytics_events`                            | Acteurs du jour **ayant consenti**, par étape : visite, résultats, fiche, intention de contact, contact, visite demandée, visite réalisée, lead.     |
| `search.*`                            | `search_submitted`                            | Recherches, zéro résultat, par commune, type d'annonce, type de bien, tranche de budget, filtre utilisé.                                             |
| `reco.*` par version d'algorithme     | événements de recommandation                  | Pages servies, éléments servis, impressions (affichage réel), ouvertures, conversions, rejets, retours.                                              |
| `kpi.*`                               | tables métier                                 | Inscriptions, annonces créées et publiées, contacts, visites demandées / confirmées / réalisées, leads, délai médian de première réponse.            |
| `analytics_listing_daily`             | événements + `conversations` + `appointments` | Vues de fiche, visiteurs du jour, impressions de carte, partages, intentions, contacts, visites, leads, impressions et ouvertures de recommandation. |

Règles de calcul :

- Les KPI métier viennent des tables métier (sources de vérité), indépendamment du consentement.
- **Taux de clic des recommandations = ouvertures / impressions affichées**, jamais / recommandations générées.
- Un « acteur » est le compte, sinon l'identifiant anonyme, sinon la visite. Sommer `actors` sur plusieurs jours donne des **acteur-jours**, pas des personnes uniques.
- L'entonnoir ne couvre que la cohorte consentante : il sous-estime le trafic réel ; les KPI métier, eux, sont exhaustifs.

## Lecture

| Route                                         | Accès                                                             | Contenu                                                      |
| --------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `GET /api/v1/analytics/listings/:listingId`   | `analytics:read` + gestion courante du bien, ou `analytics:admin` | Totaux, taux (contact, visite, clic reco), série journalière |
| `GET /api/v1/analytics/me/listings`           | connecté (vide sans `analytics:read`)                             | Annonces gérées, paginées, avec totaux et taux               |
| `GET /api/v1/admin/analytics/overview`        | `analytics:admin`                                                 | KPI, délai médian de réponse par jour                        |
| `GET /api/v1/admin/analytics/funnel`          | `analytics:admin`                                                 | Étapes en acteur-jours et taux de passage                    |
| `GET /api/v1/admin/analytics/search`          | `analytics:admin`                                                 | Volumes, taux de zéro résultat, ventilations                 |
| `GET /api/v1/admin/analytics/recommendations` | `analytics:admin`                                                 | Indicateurs par version d'algorithme                         |
| `GET /api/v1/admin/analytics/quality`         | `analytics:admin`                                                 | Rejets par motif, état de l'agrégation                       |

- Paramètres `from`, `to` (`AAAA-MM-JJ`, UTC, inclusifs) ; 30 jours par défaut, 366 au plus (400 `ANALYTICS_RANGE_INVALID`).
- Une annonce absente ou non gérée renvoie **404** (son existence n'est pas révélée).
- Réponses construites **uniquement à partir des agrégats** : jamais d'événement brut, d'identifiant de visiteur ni de comportement individuel.
- Ventilations d'administration : les groupes de moins de `ANALYTICS_MIN_GROUP_SIZE` (5) acteurs sont fusionnés dans `OTHER`, supprimé s'il reste lui-même trop petit.
- `meta.computedAt` indique la fraîcheur (dernier calcul réussi) : les chiffres du jour sont partiels.
- Permissions : `analytics:read` pour OWNER, AGENT et AGENCY ; `analytics:admin` pour ADMIN et SUPER_ADMIN.

## Rétention

| Donnée                   | Durée                                                            |
| ------------------------ | ---------------------------------------------------------------- |
| `analytics_events`       | `ANALYTICS_RETENTION_DAYS` (395 jours ≈ 13 mois), purge par lots |
| Agrégats                 | Conservés (aucune donnée individuelle)                           |
| Navigation d'un compte   | Supprimée au retrait du consentement                             |
| Statistiques d'ingestion | Conservées (compteurs)                                           |

La suppression d'un compte met `user_id` à NULL (clé étrangère `SET NULL`) ; les événements restent pseudonymisés jusqu'à leur purge.

## Exploitation

```bash
pnpm --filter @mon-appart/api analytics:run                                   # agrégation + purge
pnpm --filter @mon-appart/api analytics:recompute -- --from 2026-10-01 --to 2026-10-13
pnpm --filter @mon-appart/api analytics:purge
```

Après une correction d'une règle de calcul, recalculer la période concernée (limitée à la rétention).

### Métriques Prometheus

Labels de faible cardinalité uniquement (jamais de propriété, d'identifiant ni de nom d'annonce) :

| Métrique                             | Labels              |
| ------------------------------------ | ------------------- |
| `analytics_events_total`             | `source`, `outcome` |
| `analytics_events_rejected_total`    | `source`, `reason`  |
| `analytics_ingest_latency_ms`        | —                   |
| `analytics_tracking_failures_total`  | —                   |
| `analytics_job_runs_total`           | `job`, `outcome`    |
| `analytics_job_duration_ms`          | `job`               |
| `analytics_job_last_success_seconds` | `job`               |
| `analytics_events_purged_total`      | —                   |

Alertes suggérées : aucun succès d'`aggregate_daily` depuis plus d'une heure ; taux de rejet > 5 % ; `analytics_tracking_failures_total` en hausse.

## Configuration

| Variable                            | Défaut                 | Rôle                                                            |
| ----------------------------------- | ---------------------- | --------------------------------------------------------------- |
| `ANALYTICS_ENABLED`                 | `true`                 | `false` : collecte et instrumentation ignorées (réponses 202)   |
| `ANALYTICS_POLICY_VERSION`          | `2026-10`              | Version de la politique ; la changer invalide les consentements |
| `ANALYTICS_RATE_LIMIT`              | `60`                   | Lots par minute et par IP                                       |
| `ANALYTICS_MAX_EVENT_AGE_HOURS`     | `72`                   | Âge maximal d'un événement client                               |
| `ANALYTICS_RETENTION_DAYS`          | `395`                  | Rétention des événements bruts (7 à 1095)                       |
| `ANALYTICS_WORKER_INTERVAL_MINUTES` | `15`                   | Période du worker ; `0` le désactive (CLI seule)                |
| `ANALYTICS_LATE_DAYS`               | `3`                    | Jours clos recalculés à chaque passage                          |
| `ANALYTICS_QUALIFIED_LEAD_RULE`     | `REPLY_OR_APPOINTMENT` | `REPLY`, `APPOINTMENT` ou `REPLY_OR_APPOINTMENT`                |
| `ANALYTICS_ATTRIBUTION_HOURS`       | `72`                   | Fenêtre d'attribution aux recommandations                       |
| `ANALYTICS_MIN_GROUP_SIZE`          | `5`                    | Taille minimale d'un groupe publié                              |

## Limites connues

- Client web branché (consent + Nest URL) ; mobile non branché.
- Favoris : API Nest instrumentée (`listing_favorited` / `unfavorited`) ; UI web utilise `PropertyFavorite` legacy (pas les mêmes IDs que Nest listings).
- Le log technique existant de la recherche (`SearchService`) contient le texte saisi ; il n'est pas modifié par ce module et devrait être revu.
- Aucun rapprochement entre l'historique anonyme et le compte après connexion (choix de confidentialité).
- Les données Analytics ne sont pas transmises au service de recommandation ; un usage futur exigera des données agrégées ou pseudonymisées et une justification.
