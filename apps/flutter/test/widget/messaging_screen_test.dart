import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/router/app_routes.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/errors/app_failure.dart';

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
  testWidgets('liste vide oriente vers la recherche d\'annonces', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        sessionStore: store,
        apiClient: FakeApiClient(
          handler: (uri) async {
            if (uri.path.endsWith('/auth/me')) {
              return authUserJson();
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.messages,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Aucun message'), findsOneWidget);
    expect(find.text('Découvrir les biens'), findsOneWidget);
  });

  testWidgets('affiche une conversation et son indicateur non lu', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        sessionStore: store,
        apiClient: FakeApiClient(
          handler: (uri) async {
            if (uri.path.endsWith('/auth/me')) {
              return authUserJson();
            }
            if (uri.path.endsWith('/conversations/unread-count')) {
              return const {'unread': 2};
            }
            if (uri.path.endsWith('/conversations')) {
              return conversationPageJson(items: [conversationJson(unread: 2)]);
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.messages,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Awa K.'), findsOneWidget);
    expect(find.textContaining('Appartement 2 chambres'), findsOneWidget);
    expect(find.text('2'), findsWidgets);
  });

  testWidgets('fil de discussion charge l\'historique et envoie un message', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        sessionStore: store,
        apiClient: FakeApiClient(
          methodAwareHandler: (uri, method) async {
            if (uri.path.endsWith('/auth/me')) {
              return authUserJson();
            }
            if (uri.path.endsWith('/messages') && method == 'POST') {
              return sendMessageJson(
                message: chatMessageJson(seq: 2, body: 'Disponible demain ?'),
              );
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.conversation(testConversationId),
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Awa K.'), findsWidgets);
    expect(
      find.text('Bonjour, le bien est-il encore disponible ?'),
      findsOneWidget,
    );
    expect(find.text('À louer'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Disponible demain ?');
    await tester.tap(find.byTooltip('Envoyer'));
    await pumpFrames(tester, times: 16);
    expect(find.text('Disponible demain ?'), findsWidgets);
  });

  testWidgets('conserve le texte après un échec d\'envoi', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        sessionStore: store,
        apiClient: FakeApiClient(
          methodAwareHandler: (uri, method) async {
            if (uri.path.endsWith('/auth/me')) {
              return authUserJson();
            }
            if (uri.path.endsWith('/messages') && method == 'POST') {
              throw const TimeoutFailure();
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.conversation(testConversationId),
      ),
    );
    await pumpFrames(tester);
    await tester.enterText(find.byType(TextField), 'Toujours là');
    await tester.tap(find.byTooltip('Envoyer'));
    await pumpFrames(tester, times: 16);
    expect(find.text('Toujours là'), findsOneWidget);
    expect(find.textContaining('trop de temps'), findsWidgets);
  });

  testWidgets('conversation 404 affiche un état inaccessible', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final store = InMemorySessionStore();
    await store.save(const SessionTokens(accessToken: 'a', refreshToken: 'r'));
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        sessionStore: store,
        apiClient: FakeApiClient(
          handler: (uri) async {
            if (uri.path.endsWith('/auth/me')) {
              return authUserJson();
            }
            if (uri.path.contains('/conversations/')) {
              throw const HttpFailure(
                statusCode: 404,
                code: 'NOT_FOUND',
                message: 'Introuvable',
              );
            }
            return catalogHandler(uri);
          },
        ),
        initialLocation: AppRoutes.conversation(testConversationId),
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Conversation inaccessible'), findsOneWidget);
  });

  testWidgets('messages sans session demandent la connexion', (tester) async {
    await tester.pumpWidget(
      pumpMonAppart(
        config: testConfig(),
        apiClient: FakeApiClient(handler: (uri) async => catalogHandler(uri)),
        initialLocation: AppRoutes.messages,
      ),
    );
    await pumpFrames(tester);
    expect(find.text('Connexion requise'), findsOneWidget);
  });
}
