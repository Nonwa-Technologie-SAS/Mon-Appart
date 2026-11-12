# Observabilité mobile (Flutter)

Mon Appart n'a pas de projet Sentry, Firebase Crashlytics, Firebase Performance ni de SDK OpenTelemetry mobile. Le backend Nest journalise avec Pino et accepte l'en-tête `X-Request-ID` (`resolveRequestId`). Ce document décrit uniquement ce qui est implémenté dans `apps/flutter`.

Aucun secret, DSN ou identifiant de projet n'est requis pour compiler. Aucun événement n'est transmis hors de l'appareil.

## Architecture

Les écrans ne parlent pas à un fournisseur. Ils passent par `TelemetryClient`.

| Pièce                         | Rôle                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| `AppLogger`                   | Journaux debug déjà présents. Désactivés en production.         |
| `TelemetryClient`             | Événements structurés, sampling, déduplication, tampon mémoire. |
| `NetworkTelemetryInterceptor` | Durée et statut HTTP, sans corps ni query.                      |
| `FlutterTelemetryHooks`       | `FlutterError.onError` et `PlatformDispatcher.onError`.         |
| `TelemetryRouteObserver`      | Chemin d'écran, sans query.                                     |
| `FrameWindow`                 | Résumé de frames, uniquement en profil ou release.              |
| Fichier `offline-cache.json`  | Au plus 20 incidents `high` ou `critical`, déjà filtrés.        |

Si le client lève une exception interne, elle est avalée. L'application continue.

`TELEMETRY_ENABLED=false` (dart-define) désactive toute la collecte.

## Environnements

| `APP_ENV`    | Erreurs `critical` / `high` | `medium` | `low` |
| ------------ | --------------------------- | -------- | ----- |
| `local`      | toujours                    | 100 %    | 100 % |
| `staging`    | toujours                    | 50 %     | 20 %  |
| `production` | toujours                    | 20 %     | 5 %   |

La déduplication fusionne la même empreinte (type, opération, statut, chemin) pendant 60 secondes et incrémente un compteur. Le tampon mémoire est limité à 100 événements.

## Ce qui est enregistré

- Version `1.0.0+1` (constante `AppBuild`, alignée sur `pubspec.yaml`).
- Environnement, identifiant de session technique (UUID v4, pas un identifiant utilisateur).
- Rôle Nest (`OWNER`, `AGENCY`, …) pendant la session. Retiré à la déconnexion. L'identifiant utilisateur, l'e-mail et le téléphone ne sont pas copiés.
- Plateforme Flutter (`android`, `iOS`, …), pas le modèle d'appareil.
- Chemin HTTP sans UUID ni query, code statut, durée, `X-Request-ID` déjà envoyé par `DioApiClient`.
- Drain hors ligne : synchronisés, échecs temporaires, échecs définitifs, conflits HTTP 409, opérations encore ouvertes, connectivité (`offline`, `unreachable`, `online`).
- Durée entre le début de `bootstrap` et le premier frame Flutter. Ce n'est pas le démarrage natif du processus.
- Résumé de frames lentes (plus de 32 ms) par lots de 120, en build profil ou release seulement.

`GET /health/live` n'est pas journalisé, pour ne pas noyer les sondes de reconnexion.

## Ce qui n'est pas en place

- Crashs natifs Android et iOS (signal, moteur Flutter C++).
- Mémoire processus, fuites, taille d'image : pas de mesure fiable sans plugin, donc rien n'est inventé.
- Dashboards, alertes, envoi de symboles de debug.
- Analytics produit `POST /analytics/events` : toujours non branché.
- Propagation W3C `traceparent` : Nest ne la lit pas. La corrélation reste `X-Request-ID`, déjà dans les logs Pino (`request_id`).

## Seuils initiaux

Ce sont des repères pour qualifier un événement (`overBudget`). Ils ne sont pas des résultats mesurés.

| Repère                          | Valeur   |
| ------------------------------- | -------- |
| Premier frame après `bootstrap` | 2 500 ms |
| Requête API lente               | 2 000 ms |
| Frame lente                     | 32 ms    |

## Confidentialité

Les messages passent par le même filtre que les journaux HTTP : `authorization`, mots de passe, OTP, jetons, e-mails, chemins `/Users/<nom>`. Les attributs dont la clé est sensible sont omis, pas masqués dans un journal. Les corps de requête et le texte des conversations ne sont pas collectés.

Les incidents locaux restent dans le fichier de cache applicatif, non chiffré, au même titre que le cache hors ligne. Ils ne contiennent pas les jetons (ceux-ci restent dans `flutter_secure_storage`).

## Android et iOS

Aucune modification Gradle, `AndroidManifest`, Info.plist ou capability n'est nécessaire : il n'y a pas de SDK natif. La CI (`.github/workflows/ci.yml`) lance déjà `dart format`, `flutter analyze`, `flutter test` et un APK debug. Elle n'uploade pas de symboles, parce qu'il n'y a pas de projet de crash reporting.

iOS n'est pas compilé sur Windows. Un build release iOS n'a pas été vérifié ici.

## Retrouver un incident

1. Demander la version affichée dans les réglages du téléphone et la plateforme (Android ou iOS).
2. Sur un build local avec `ENABLE_NETWORK_LOGS=true`, les lignes `telemetry …` sortent dans la console debug.
3. Après un redémarrage, les derniers incidents hauts sont dans `telemetry/incidents` du fichier `offline-cache.json` (répertoire support de l'application).
4. Relever `correlationId` s'il s'agit d'un appel API.
5. Chercher le même `request_id` dans les logs Pino de l'API Nest.
6. Pour la synchro : `connectivity` vaut `offline` (pas de réseau), `unreachable` (réseau sans API) ou `online` avec `failedPermanent` / `conflicts`.
7. Corriger, livrer, puis vérifier qu'un scénario de test unitaire couvre le cas. Ne pas provoquer de crash dans un binaire de production pour « tester Sentry » : Sentry n'est pas branché.

## Quand un fournisseur sera choisi

Ajouter un `TelemetrySink` derrière `TelemetryClient`, avec un DSN fourni par l'environnement de build et jamais commité. Envoyer les symboles depuis la CI. Ne pas ajouter un second outil en parallèle. Les crashs natifs resteront invisibles tant que ce SDK n'est pas là.
