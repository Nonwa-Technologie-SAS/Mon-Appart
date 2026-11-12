import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/router/app_routes.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/errors/app_failure.dart';

import '../helpers/auth_fixtures.dart';
import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/test_app.dart';

Future<void> pumpFrames(WidgetTester tester, {int times = 8}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  testWidgets('espace personnel affiche le profil et les raccourcis réels', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(
            firstName: 'Awa',
            lastName: 'Koné',
            emailVerified: true,
            status: 'ACTIVE',
          );
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        sessionStore: store,
        initialLocation: AppRoutes.account,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Awa Koné'), findsOneWidget);
    expect(find.text('Vérifié'), findsOneWidget);
    expect(find.text('Préférences immobilières'), findsOneWidget);
    expect(find.text('Comparaison'), findsOneWidget);
    expect(find.text('Mes visites'), findsOneWidget);
    expect(find.text('Recherches enregistrées'), findsOneWidget);
    expect(find.text('Confidentialité'), findsOneWidget);
    expect(find.text('Supprimer le compte'), findsNothing);
  });

  testWidgets('modification du profil préremplit et envoie PATCH /auth/me', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    var firstName = 'Awa';
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(firstName: firstName, lastName: 'Koné');
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        sessionStore: store,
        initialLocation: AppRoutes.editProfile,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Awa'), findsOneWidget);
    expect(find.text('Koné'), findsOneWidget);
    expect(find.text('user@example.com'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, 'Ami');
    firstName = 'Ami';
    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.tap(find.text('Enregistrer'));
    await pumpFrames(tester);
    expect(client.methods.contains('PATCH'), isTrue);
    expect(client.lastBody?['firstName'], 'Ami');
    expect(find.text('Profil enregistré.'), findsOneWidget);
  });

  testWidgets('erreur de formulaire profil sans appeler Nest', (tester) async {
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson();
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        sessionStore: store,
        initialLocation: AppRoutes.editProfile,
      ),
    );
    await pumpFrames(tester);
    await tester.enterText(find.byType(TextField).first, 'A' * 101);
    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.tap(find.text('Enregistrer'));
    await pumpFrames(tester);
    expect(find.textContaining('100 caractères'), findsOneWidget);
    expect(client.methods.contains('PATCH'), isFalse);
  });

  testWidgets('préférences : absence distincte d\'une erreur de chargement', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(status: 'ACTIVE', emailVerified: true);
        }
        if (uri.path.endsWith('/recommendations/preferences')) {
          return emptyHousingPreferencesJson();
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        sessionStore: store,
        initialLocation: AppRoutes.housingPreferences,
      ),
    );
    await pumpFrames(tester);
    expect(
      find.textContaining('Aucune préférence enregistrée'),
      findsOneWidget,
    );
    expect(find.text('Préférences indisponibles'), findsNothing);
  });

  testWidgets('préférences : erreur réseau n\'est pas un état vide', (
    tester,
  ) async {
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(status: 'ACTIVE', emailVerified: true);
        }
        if (uri.path.endsWith('/recommendations/preferences')) {
          throw const NetworkFailure();
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        sessionStore: store,
        initialLocation: AppRoutes.housingPreferences,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Préférences indisponibles'), findsOneWidget);
    expect(find.textContaining('Aucune préférence enregistrée'), findsNothing);
  });

  testWidgets('préférences : budget incohérent sans PUT', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(status: 'ACTIVE', emailVerified: true);
        }
        if (uri.path.endsWith('/recommendations/preferences')) {
          return emptyHousingPreferencesJson();
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        sessionStore: store,
        initialLocation: AppRoutes.housingPreferences,
      ),
    );
    await pumpFrames(tester);
    await tester.enterText(find.widgetWithText(TextField, 'Minimum'), '300000');
    await tester.enterText(find.widgetWithText(TextField, 'Maximum'), '100000');
    await tester.ensureVisible(find.text('Enregistrer les préférences'));
    await tester.tap(find.text('Enregistrer les préférences'));
    await pumpFrames(tester);
    expect(find.textContaining('minimum ne peut pas dépasser'), findsOneWidget);
    expect(client.methods.contains('PUT'), isFalse);
  });

  testWidgets('préférences : sauvegarde PUT puis confirmation', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    late final FakeApiClient client;
    client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(status: 'ACTIVE', emailVerified: true);
        }
        if (uri.path.endsWith('/recommendations/preferences')) {
          if (client.methods.contains('PUT')) {
            return {
              ...emptyHousingPreferencesJson(),
              'listingTypes': ['RENT'],
              'budget': {
                'min': null,
                'max': 200000,
                'currency': 'XOF',
                'period': 'MONTH',
                'tolerancePct': 0,
              },
            };
          }
          return emptyHousingPreferencesJson();
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        sessionStore: store,
        initialLocation: AppRoutes.housingPreferences,
      ),
    );
    await pumpFrames(tester);
    await tester.tap(find.text('À louer'));
    await tester.enterText(find.widgetWithText(TextField, 'Maximum'), '200000');
    await tester.ensureVisible(find.text('Enregistrer les préférences'));
    await tester.tap(find.text('Enregistrer les préférences'));
    await pumpFrames(tester, times: 16);
    expect(client.methods.contains('PUT'), isTrue);
    expect(client.lastBody?['listingTypes'], ['RENT']);
    expect(client.lastBody?['maxBudget'], 200000);
    expect(client.lastBody?['budgetPeriod'], 'MONTH');
    expect(find.textContaining('Préférences enregistrées'), findsOneWidget);
  });

  testWidgets('recherches enregistrées vides et raccourci Explorer', (
    tester,
  ) async {
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(status: 'ACTIVE', emailVerified: true);
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        sessionStore: store,
        initialLocation: AppRoutes.savedSearches,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Aucune recherche enregistrée'), findsOneWidget);
    await tester.tap(find.text('Explorer'));
    await pumpFrames(tester);
    expect(find.text('Explorer'), findsWidgets);
  });

  testWidgets('mot de passe : refuse une confirmation différente sans POST', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(status: 'ACTIVE', emailVerified: true);
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        sessionStore: store,
        initialLocation: AppRoutes.changePassword,
      ),
    );
    await pumpFrames(tester);
    await tester.enterText(find.byType(TextField).at(0), 'phrase-solide-42');
    await tester.enterText(
      find.byType(TextField).at(1),
      'autre-phrase-solide-99',
    );
    await tester.enterText(find.byType(TextField).at(2), 'mismatch-value');
    await tester.ensureVisible(find.text('Mettre à jour'));
    await tester.tap(find.text('Mettre à jour'));
    await pumpFrames(tester);
    expect(
      find.text('Les mots de passe ne correspondent pas.'),
      findsOneWidget,
    );
    expect(
      client.uris.any((uri) => uri.path.endsWith('/auth/change-password')),
      isFalse,
    );
  });

  testWidgets('confidentialité documente photo et suppression absentes', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
        initialLocation: AppRoutes.accountPrivacy,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Confidentialité'), findsWidgets);
    await tester.ensureVisible(find.text('Photo de profil'));
    expect(find.text('Photo de profil'), findsOneWidget);
    expect(find.textContaining('UserResponseDto'), findsOneWidget);
    await tester.ensureVisible(find.text('Suppression du compte'));
    expect(find.textContaining('Aucun endpoint utilisateur'), findsOneWidget);
  });

  testWidgets('notifications n\'affiche un interrupteur que si canToggle', (
    tester,
  ) async {
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(status: 'ACTIVE', emailVerified: true);
        }
        if (uri.path.endsWith('/notification-preferences')) {
          return {
            'items': [
              {
                'category': 'MESSAGES',
                'channel': 'EMAIL',
                'enabled': true,
                'locked': false,
                'available': true,
              },
              {
                'category': 'ACCOUNT',
                'channel': 'EMAIL',
                'enabled': true,
                'locked': true,
                'available': true,
              },
            ],
          };
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        sessionStore: store,
        initialLocation: AppRoutes.notificationPreferences,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Messages'), findsOneWidget);
    expect(find.text('Paramètre verrouillé'), findsOneWidget);
    expect(find.byType(SwitchListTile), findsNWidgets(2));
    final locked = tester.widget<SwitchListTile>(
      find.widgetWithText(SwitchListTile, 'E-mail').last,
    );
    expect(locked.onChanged, isNull);
  });
}
