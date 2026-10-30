import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/router/app_routes.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/core/offline/memory_key_value_store.dart';
import 'package:mon_appart/core/offline/offline_messages.dart';

import '../helpers/auth_fixtures.dart';
import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/messaging_fixtures.dart';
import '../helpers/test_app.dart';

Future<void> pumpFrames(WidgetTester tester, {int times = 10}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  testWidgets('hors ligne : la liste des favoris en cache reste lisible', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final cache = MemoryKeyValueStore();
    var online = true;
    final client = FakeApiClient(
      serveHealthLive: false,
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(emailVerified: true, status: 'ACTIVE');
        }
        if (uri.path.endsWith('/interactions/favorites')) {
          if (!online) {
            throw const NetworkFailure();
          }
          return {
            'items': [
              {
                'listingId': testListingId,
                'propertyId': '22222222-2222-2222-2222-222222222222',
                'title': 'Villa cache',
                'createdAt': '2026-10-20T10:00:00.000Z',
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
        keyValueStore: cache,
        initialLocation: AppRoutes.favorites,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Villa cache'), findsOneWidget);

    online = false;
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        sessionStore: store,
        keyValueStore: cache,
        initialLocation: AppRoutes.favorites,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Villa cache'), findsOneWidget);
  });

  testWidgets('file d\'attente : un favori hors ligne n\'est pas confirmé', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final client = FakeApiClient(
      serveHealthLive: false,
      methodAwareHandler: (uri, method) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(emailVerified: true, status: 'ACTIVE');
        }
        if (uri.path.contains('/interactions/favorites')) {
          if (method == 'GET' && !uri.path.endsWith('/favorites')) {
            return const {'favorited': false};
          }
          if (method == 'GET') {
            return const {'items': <Object?>[]};
          }
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
        initialLocation: AppRoutes.listing(testListingId),
      ),
    );
    await pumpFrames(tester);
    await tester.tap(find.byTooltip('Ajouter aux favoris'));
    await pumpFrames(tester);
    expect(find.text(OfflineMessages.queuedFavorite), findsOneWidget);
  });
}
