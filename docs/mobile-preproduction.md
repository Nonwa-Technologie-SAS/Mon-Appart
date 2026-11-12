# Validation préproduction — application Flutter Mon Appart

Ce document décrit la stratégie de tests du client `apps/flutter` et la décision de publication. Ce n’est pas un test d’intrusion, ni une validation sur appareils physiques.

Flutter 3.47.8, Dart 3.13.7. Les tests tournent sur la machine virtuelle Flutter, avec `FakeApiClient`. Ils ne parlent pas à un Nest de production.

## Pyramide réelle

| Niveau                      | Où                                                   | Ce qu’il prouve                                                                    | Ce qu’il ne prouve pas                                                         |
| --------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Unitaire                    | `test/core`, `test/features`                         | Règles, parseurs, files, auth, synchro, sécurité                                   | Le rendu, un téléphone                                                         |
| Widget                      | `test/widget`                                        | Écrans, formulaires, navigation, états vides et d’erreur, avec un faux client HTTP | Un APK installé, le réseau réel                                                |
| Configuration               | `test/release/preproduction_guards_test.dart`        | Manifeste, ATS iOS, absence de secrets évidents dans les sources                   | Un keystore Play, un binaire release                                           |
| Intégration API réelle      | `apps/api` (`pnpm --filter @mon-appart/api test:db`) | Contrats Nest sur Postgres de test                                                 | L’application Flutter                                                          |
| E2E appareil                | Absent                                               | —                                                                                  | Aucun parcours n’a été joué sur émulateur, simulateur ou téléphone dans ce lot |
| Performance profile/release | Absent                                               | —                                                                                  | Aucun temps de démarrage, aucune frame, aucune mesure mémoire                  |

Il n’y a pas de `integration_test/` ni de golden tests. Les golden ont été écartés : ils cassent entre machines sans protéger un parcours métier.

Les 400+ tests déjà présents couvrent, sans être recopiés ici : auth, recherche, XOF, fiches, favoris, profil, notifications (contrat seulement), messagerie, visites, publication, carte, assistant, comparaison, tournée, hors ligne, observabilité, sécurité. Le lot 20 ajoute le changement de compte, la purge à la déconnexion et les garde-fous de configuration.

## Commandes

Depuis `apps/flutter` :

```bash
dart format --output=none --set-exit-if-changed .
flutter analyze
flutter test
flutter test test/core/auth/auth_controller_test.dart
flutter test test/core/offline
flutter test test/release/preproduction_guards_test.dart
flutter test test/widget
```

Couverture, si on veut un fichier et non un pourcentage inventé :

```bash
flutter test --coverage
```

Le fichier produit est `coverage/lcov.info`. Il n’est pas versionné et aucun seuil n’est imposé en CI : un pourcentage global n’a pas été calculé dans ce lot.

APK debug, comme la CI :

```bash
flutter build apk --debug --dart-define=API_BASE_URL=http://127.0.0.1:4000 --dart-define=APP_ENV=local --dart-define=ENABLE_NETWORK_LOGS=false
```

iOS : `flutter build ios` exige macOS et Xcode. Cette machine est Windows. Le job CI `flutter` tourne sur `ubuntu-latest` et ne lance pas cette commande.

## Données de test

| Jeu                                   | Usage            | Identité                                                                                                                 |
| ------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Fixtures Dart (`test/helpers`)        | Tests Flutter    | `user@example.com`, annonces « Cocody » fictives, UUID de test                                                           |
| `apps/api/prisma/seed/development.ts` | Base locale Nest | `owner@demo.mon-appart.local`, `customer@…`, `agent@…`. Mot de passe documenté dans ce fichier, réservé au développement |
| Production                            | Interdit         | Aucun test de ce dépôt ne cible une base de production                                                                   |

Réinitialiser le seed local : suivre le README API (`db:seed` / migrate du projet). Ne pas copier une base de production.

## CI

Job `flutter` de `.github/workflows/ci.yml` :

1. `flutter pub get`
2. `dart format --output=none --set-exit-if-changed .`
3. `flutter analyze`
4. `flutter test` (inclut les garde-fous release)
5. `flutter build apk --debug` avec une URL locale

Pas de job macOS, pas d’upload de symboles, pas de signature Play, pas de seuil de couverture. Un échec de ce job bloque la CI. Il ne bloque pas un store auquel on n’a pas publié.

Aucun test n’est désactivé pour obtenir une CI verte.

## Matrice de plateformes

| Vérification                            | VM de test Flutter              | Émulateur Android | Appareil Android | Simulateur iOS | Appareil iOS |
| --------------------------------------- | ------------------------------- | ----------------- | ---------------- | -------------- | ------------ |
| Suite `flutter test`                    | Exécutée dans ce lot            | Non               | Non              | Non            | Non          |
| APK debug CI                            | Script présent, non relancé ici | Non               | Non              | —              | —            |
| APK ou AAB release signé                | Non                             | Non               | Non              | —              | —            |
| Build iOS                               | Non                             | —                 | —                | Non            | Non          |
| `FLAG_SECURE`, Keychain, permissions OS | Non                             | Non               | Non              | Non            | Non          |

Une session `flutter run` peut être ouverte sur un poste de développement. Elle n’a pas servi de campagne de validation.

## Parcours critiques et où ils sont couverts

| Parcours                                                                      | Couverture actuelle                                 | Trou                                                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| Recherche, filtres, ouverture de fiche, retour                                | Widget `explore_screen_test`                        | Pas sur appareil                                                        |
| Fiche, galerie, contact, visite non confirmée                                 | Widget `listing_detail_screen_test`                 | Pas de créneau réel : Nest n’expose pas de calendrier de disponibilités |
| Compte, profil, préférences, mot de passe                                     | Widget `account_screen_test` et auth                | Pas d’OTP réel                                                          |
| Favori hors ligne puis file d’attente                                         | `offline_favorites_test`, `sync_engine_test`        | Pas de coupure Wi-Fi physique                                           |
| Changement de compte                                                          | `auth_controller_test`                              | Pas de second utilisateur sur un téléphone                              |
| Messagerie, visites, pro, publication, carte, assistant, comparaison, tournée | Widgets et règles dédiés                            | Pas de Socket.IO réel, pas de FCM                                       |
| Sécurité locale                                                               | `mobile_security_test`, `preproduction_guards_test` | Pas d’extraction du trousseau sur appareil                              |

Les messages d’erreur visibles viennent des écrans déjà testés (session, réseau, annonce introuvable, visite non confirmée, upload refusé par les règles MIME). Le backend reste l’autorité.

## Anomalies ouvertes

| Id     | Gravité              | Constat                                                                                                             | Statut                                            |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| REL-01 | Bloquant publication | `android/app/build.gradle.kts` signe la release avec la clé debug. Le test `preproduction_guards_test` le constate. | Ouvert. Ne pas générer de keystore dans le dépôt. |
| REL-02 | Majeur               | Aucun build iOS exécuté.                                                                                            | Ouvert tant qu’il n’y a pas de macOS.             |
| REL-03 | Majeur               | Pas de validation sur appareil ou émulateur dans cette campagne.                                                    | Ouvert.                                           |
| REL-04 | Majeur               | Pas de politique de confidentialité ni de conditions avec URL publique. L’écran Confidentialité le dit.             | Ouvert, juridique.                                |
| REL-05 | Majeur               | Pas d’endpoint de suppression de compte. L’application ne simule pas la suppression.                                | Ouvert, backend.                                  |
| REL-06 | Mineur produit       | Push natif non branché (`NOTIFICATION_PUSH_PROVIDER` vide).                                                         | Connu, pas une régression.                        |
| REL-07 | Mineur               | Le JSON hors ligne n’est pas chiffré. Il ne contient plus les jetons, l’e-mail ni le téléphone.                     | Accepté, documenté dans `mobile-security.md`.     |

Aucune de ces lignes n’est un échec de la suite `flutter test`.

## Go / No-Go

**NO-GO pour une publication Google Play ou App Store.**

Raisons observées, pas supposées :

- La release Android est signée avec la clé debug (REL-01).
- iOS n’a pas été compilé (REL-02).
- Aucun parcours n’a été rejoué sur un appareil (REL-03).
- La fiche store (confidentialité, suppression de compte) n’est pas prête (REL-04, REL-05).

La suite automatisée peut être verte sans que cela autorise le store. Un GO ultérieur exige : keystore hors dépôt, AAB release, build iOS signé, au moins un appareil Android et un appareil iOS sur les parcours recherche, auth, favori hors ligne, et une URL de politique validée. Le cache non chiffré (REL-07) et l’absence de push (REL-06) peuvent rester en GO SOUS RÉSERVE une fois les bloquants ci-dessus fermés.

## Tests instables

Aucun test n’est marqué `skip`. Les horloges des files hors ligne sont injectées. Les widgets pompent des frames fixes (`pumpFrames`) : si un test devient intermittent, il faut l’attendre sur un finder, pas ajouter une pause au hasard, et ne pas le désactiver.
