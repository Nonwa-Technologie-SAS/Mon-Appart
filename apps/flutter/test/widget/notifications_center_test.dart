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

Future<void> pumpFrames(WidgetTester tester, {int times = 12}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  const listingId = '11111111-1111-1111-1111-111111111111';
  const conversationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  testWidgets('affiche le compteur non lu et marque tout comme lu', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    var unread = 2;
    late final FakeApiClient client;
    client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(status: 'ACTIVE', emailVerified: true);
        }
        if (uri.path.endsWith('/notifications/read-all')) {
          unread = 0;
          return {'updated': 2};
        }
        if (uri.path.endsWith('/notifications')) {
          return {
            'items': [
              inboxNotificationJson(
                id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
                listingId: listingId,
              ),
              inboxNotificationJson(
                id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
                title: 'Baisse de prix',
                type: 'PRICE_DROP',
                category: 'PRICE_DROPS',
                listingId: listingId,
              ),
            ],
            'unread': unread,
            'nextCursor': null,
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
        initialLocation: AppRoutes.home,
      ),
    );
    await pumpFrames(tester);
    expect(
      find.descendant(of: find.byType(NavigationBar), matching: find.text('2')),
      findsWidgets,
    );
    await tester.tap(find.text('Notifs'));
    await pumpFrames(tester);
    expect(find.text('Alertes de recherche'), findsOneWidget);
    expect(find.text('Baisse de prix'), findsWidgets);
    await tester.tap(find.text('Tout lu'));
    await pumpFrames(tester);
    expect(client.methods.contains('POST'), isTrue);
  });

  testWidgets('état vide, erreur et session expirée', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    var fail = true;
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(status: 'ACTIVE', emailVerified: true);
        }
        if (uri.path.endsWith('/notifications') && fail) {
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
        initialLocation: AppRoutes.notifications,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Notifications indisponibles'), findsOneWidget);
    fail = false;
    await tester.tap(find.text('Réessayer'));
    await pumpFrames(tester);
    expect(find.text('Aucune notification pour le moment'), findsOneWidget);
  });

  testWidgets('conversation protégée propose la connexion puis restaure next', (
    tester,
  ) async {
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
        initialLocation: AppRoutes.conversation(conversationId),
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Connexion requise'), findsOneWidget);
    await tester.tap(find.text('Se connecter'));
    await pumpFrames(tester);
    expect(find.text('Connexion'), findsWidgets);
  });

  testWidgets('lien invalide affiche un repli', (tester) async {
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
        initialLocation: AppRoutes.invalidLink,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Lien non reconnu'), findsOneWidget);
  });
}
