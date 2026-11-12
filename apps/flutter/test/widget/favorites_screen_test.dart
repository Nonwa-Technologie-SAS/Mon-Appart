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
  testWidgets('liste les titres Nest et retire un favori via DELETE', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    var items = [favoriteItemJson()];
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(status: 'ACTIVE', emailVerified: true);
        }
        if (uri.path.endsWith('/interactions/favorites')) {
          return {'items': items};
        }
        if (uri.path.contains('/interactions/favorites/')) {
          items = [];
          return const {'favorited': false};
        }
        return catalogHandler(uri);
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        sessionStore: store,
        initialLocation: AppRoutes.favorites,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Appartement 2 chambres à Cocody'), findsOneWidget);
    await tester.tap(find.byTooltip('Retirer des favoris'));
    await pumpFrames(tester);
    expect(client.methods.contains('DELETE'), isTrue);
    expect(find.text('Aucun favori enregistré'), findsOneWidget);
  });

  testWidgets('erreur de chargement n\'invente pas de favoris', (tester) async {
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(status: 'ACTIVE', emailVerified: true);
        }
        if (uri.path.endsWith('/interactions/favorites')) {
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
        initialLocation: AppRoutes.favorites,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Favoris indisponibles'), findsOneWidget);
    expect(find.text('Appartement 2 chambres à Cocody'), findsNothing);
  });
}
