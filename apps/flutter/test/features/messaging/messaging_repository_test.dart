import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/core/ids/uuid_v4.dart';
import 'package:mon_appart/features/messaging/data/messaging_repository.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/listing_fixtures.dart';
import '../../helpers/messaging_fixtures.dart';

void main() {
  final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));

  Future<MessagingRepository> repo(FakeApiClient client) async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'access', refreshToken: 'refresh'),
    );
    return MessagingRepository(
      client: client,
      endpoints: endpoints,
      sessionStore: store,
    );
  }

  test('liste les conversations avec curseur', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/conversations')) {
          expect(uri.queryParameters['archived'], 'false');
          return conversationPageJson(
            items: [conversationJson(unread: 1)],
            nextCursor: 'next',
          );
        }
        return catalogHandler(uri);
      },
    );
    final messaging = await repo(client);
    final page = await messaging.list();
    expect(page.items, hasLength(1));
    expect(page.nextCursor, 'next');
    expect(page.items.first.unread, 1);
  });

  test('envoie un message avec clientMessageId UUID v4', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/messages')) {
          return sendMessageJson();
        }
        return catalogHandler(uri);
      },
    );
    final messaging = await repo(client);
    final clientMessageId = UuidV4.generate();
    final result = await messaging.send(
      conversationId: testConversationId,
      body: 'Merci',
      clientMessageId: clientMessageId,
    );
    expect(result.duplicate, isFalse);
    expect(result.message.body, 'Merci');
    expect(client.lastBody?['clientMessageId'], clientMessageId);
    expect(client.lastBody?['body'], 'Merci');
  });

  test('refuse un message vide sans appeler Nest', () async {
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    final messaging = await repo(client);
    await expectLater(
      messaging.send(
        conversationId: testConversationId,
        body: '   ',
        clientMessageId: UuidV4.generate(),
      ),
      throwsA(isA<InquiryValidationFailure>()),
    );
    expect(client.calls, 0);
  });

  test('transforme un 404 conversation en indisponible', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        throw const HttpFailure(
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Introuvable',
        );
      },
    );
    final messaging = await repo(client);
    await expectLater(
      messaging.getById(testConversationId),
      throwsA(isA<ConversationUnavailableFailure>()),
    );
  });

  test('n\'appelle pas Nest sans session', () async {
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    final messaging = MessagingRepository(
      client: client,
      endpoints: endpoints,
      sessionStore: InMemorySessionStore(),
    );
    await expectLater(messaging.list(), throwsA(isA<NeedsAuthFailure>()));
    expect(client.calls, 0);
  });
}
