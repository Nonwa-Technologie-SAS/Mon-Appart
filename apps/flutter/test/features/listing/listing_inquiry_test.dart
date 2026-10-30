import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/features/listing/data/listing_inquiry_repository.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/listing_fixtures.dart';
import '../../helpers/messaging_fixtures.dart';

void main() {
  test('refuse un message vide et une date passée', () {
    expect(InquiryRules.messageError('   '), isNotNull);
    expect(
      InquiryRules.scheduleError(DateTime(2020), now: DateTime(2026, 1, 1)),
      isNotNull,
    );
    expect(
      InquiryRules.scheduleError(
        DateTime(2026, 2, 1),
        now: DateTime(2026, 1, 1),
      ),
      isNull,
    );
  });

  test('n\'appelle pas Nest sans session', () async {
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    final repo = ListingInquiryRepository(
      client: client,
      endpoints: ApiEndpoints(Uri.parse('http://10.0.2.2:4000')),
      sessionStore: InMemorySessionStore(),
    );
    await expectLater(
      repo.contact(
        listingId: '11111111-1111-1111-1111-111111111111',
        message: 'Bonjour',
      ),
      throwsA(isA<NeedsAuthFailure>()),
    );
    expect(client.calls, 0);
  });

  test(
    'envoie une demande de visite sans la présenter comme confirmée',
    () async {
      final store = InMemorySessionStore();
      await store.save(
        const SessionTokens(accessToken: 'access', refreshToken: 'refresh'),
      );
      final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
      final repo = ListingInquiryRepository(
        client: client,
        endpoints: ApiEndpoints(Uri.parse('http://10.0.2.2:4000')),
        sessionStore: store,
      );
      final visit = await repo.requestVisit(
        listingId: '11111111-1111-1111-1111-111111111111',
        scheduledAt: DateTime.utc(2026, 11, 2, 10),
        notes: 'Disponible le matin',
        now: DateTime.utc(2026, 10, 28),
      );
      expect(visit.status, 'PENDING');
      expect(client.methods, contains('POST'));
      expect(client.lastBody?['timezone'], 'Africa/Abidjan');
      expect(client.lastBody?['notes'], 'Disponible le matin');
    },
  );

  test('n\'envoie pas un message vide même avec une session', () async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'access', refreshToken: 'refresh'),
    );
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    final repo = ListingInquiryRepository(
      client: client,
      endpoints: ApiEndpoints(Uri.parse('http://10.0.2.2:4000')),
      sessionStore: store,
    );
    await expectLater(
      repo.contact(
        listingId: '11111111-1111-1111-1111-111111111111',
        message: '   ',
      ),
      throwsA(isA<InquiryValidationFailure>()),
    );
    expect(client.calls, 0);
  });

  test('envoie un contact via POST /conversations', () async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'access', refreshToken: 'refresh'),
    );
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/conversations')) {
          return startConversationJson();
        }
        return catalogHandler(uri);
      },
    );
    final repo = ListingInquiryRepository(
      client: client,
      endpoints: ApiEndpoints(Uri.parse('http://10.0.2.2:4000')),
      sessionStore: store,
    );
    final started = await repo.contact(
      listingId: '11111111-1111-1111-1111-111111111111',
      message: 'Bonjour, le bien est-il encore disponible ?',
    );
    expect(started.created, isTrue);
    expect(started.conversation.id, testConversationId);
    expect(client.methods, contains('POST'));
    expect(client.uris.single.path, endsWith('/conversations'));
    expect(
      client.lastBody?['listingId'],
      '11111111-1111-1111-1111-111111111111',
    );
    expect(
      client.lastBody?['message'],
      'Bonjour, le bien est-il encore disponible ?',
    );
    expect(client.lastBody?['clientMessageId'], isA<String>());
  });
}
