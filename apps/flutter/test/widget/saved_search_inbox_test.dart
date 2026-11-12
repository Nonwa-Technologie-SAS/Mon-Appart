import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/router/app_routes.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';

import '../helpers/auth_fixtures.dart';
import '../helpers/fake_api_client.dart';
import '../helpers/listing_fixtures.dart';
import '../helpers/test_app.dart';

Future<void> pumpFrames(WidgetTester tester, {int times = 10}) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

void main() {
  testWidgets('enregistre la recherche courante depuis Explorer', (
    tester,
  ) async {
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
        if (uri.path.endsWith('/saved-searches') &&
            client.methods.isNotEmpty &&
            client.methods.last == 'POST') {
          return savedSearchJson(
            name: (client.lastBody?['name'] as String?) ?? 'Cocody',
          );
        }
        return catalogHandler(uri, search: searchResponseJson());
      },
    );
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: client,
        sessionStore: store,
        initialLocation: '/explore?listingType=RENT&commune=COCODY',
      ),
    );
    await pumpFrames(tester);
    await tester.tap(find.byTooltip('Enregistrer la recherche'));
    await pumpFrames(tester);
    expect(find.text('Enregistrer la recherche'), findsWidgets);
    await tester.tap(find.text('Enregistrer'));
    await pumpFrames(tester, times: 16);
    expect(client.methods.contains('POST'), isTrue);
    expect(client.lastBody?['params'], containsPair('commune', 'COCODY'));
    expect(client.lastBody?['params'], isNot(contains('sort')));
  });

  testWidgets('relance, alerte et confirmation de suppression', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    var item = savedSearchJson();
    late final FakeApiClient client;
    client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/auth/me')) {
          return authUserJson(status: 'ACTIVE', emailVerified: true);
        }
        if (uri.path.endsWith('/resume')) {
          return {
            'params': {'listingType': 'RENT', 'commune': 'COCODY'},
            'resumePath': '/search',
          };
        }
        if (uri.path.endsWith('/saved-searches')) {
          return {
            'items': [item],
          };
        }
        if (uri.path.contains('/saved-searches/')) {
          if (client.methods.last == 'PATCH') {
            item = savedSearchJson(
              alertsEnabled: client.lastBody?['alertsEnabled'] != false,
              frequency: (client.lastBody?['frequency'] as String?) ?? 'DAILY',
            );
            return item;
          }
          return const {};
        }
        return catalogHandler(uri, search: searchResponseJson());
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
    expect(find.text('Appartements à louer à Cocody'), findsOneWidget);
    expect(find.textContaining('Alertes'), findsWidgets);
    await tester.tap(find.text('Appartements à louer à Cocody'));
    await pumpFrames(tester);
    expect(find.text('Relancer la recherche'), findsOneWidget);
    await tester.tap(find.byType(Switch));
    await pumpFrames(tester);
    expect(client.methods.contains('PATCH'), isTrue);
    await tester.ensureVisible(find.text('Supprimer la recherche'));
    await tester.tap(find.text('Supprimer la recherche'));
    await pumpFrames(tester);
    expect(find.text('Supprimer cette recherche ?'), findsOneWidget);
    await tester.tap(find.text('Annuler'));
    await pumpFrames(tester);
    expect(find.text('Relancer la recherche'), findsOneWidget);
    await tester.tap(find.text('Relancer la recherche'));
    await pumpFrames(tester, times: 16);
    expect(client.methods.contains('POST'), isTrue);
    expect(find.textContaining('Cocody'), findsWidgets);
  });

  testWidgets('inbox ouvre la fiche ciblée et marque la notification lue', (
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
        if (uri.path.endsWith('/notifications')) {
          return {
            'items': [
              inboxNotificationJson(
                listingId: '11111111-1111-1111-1111-111111111111',
              ),
            ],
            'unread': 1,
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
        initialLocation: AppRoutes.notifications,
      ),
    );
    await pumpFrames(tester);
    expect(
      find.text('Nouvelles annonces pour votre recherche'),
      findsOneWidget,
    );
    await tester.tap(find.text('Nouvelles annonces pour votre recherche'));
    await pumpFrames(tester, times: 16);
    expect(client.methods.contains('PATCH'), isTrue);
    expect(find.text('Annonce'), findsOneWidget);
  });

  testWidgets('inbox vide sans session propose la connexion', (tester) async {
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
        initialLocation: AppRoutes.notifications,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Connexion requise'), findsOneWidget);
    await tester.tap(find.text('Se connecter'));
    await pumpFrames(tester);
    expect(find.text('Connexion'), findsWidgets);
  });
}
