import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/features/pro/data/inquiry_repository.dart';
import 'package:mon_appart/features/pro/data/pro_listings_repository.dart';
import 'package:mon_appart/features/pro/data/publisher_analytics_repository.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/listing_fixtures.dart';
import '../../helpers/pro_fixtures.dart';

void main() {
  final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));

  Future<ProListingsRepository> listings(FakeApiClient client) async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'access', refreshToken: 'refresh'),
    );
    return ProListingsRepository(
      client: client,
      endpoints: endpoints,
      sessionStore: store,
    );
  }

  Future<InquiryRepository> inquiries(FakeApiClient client) async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'access', refreshToken: 'refresh'),
    );
    return InquiryRepository(
      client: client,
      endpoints: endpoints,
      sessionStore: store,
    );
  }

  test('n\'appelle pas Nest sans session', () async {
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    final repo = ProListingsRepository(
      client: client,
      endpoints: endpoints,
      sessionStore: InMemorySessionStore(),
    );
    await expectLater(repo.list(), throwsA(isA<NeedsAuthFailure>()));
    expect(client.calls, 0);
  });

  test('liste les annonces scope=mine et publie via POST Nest', () async {
    final client = FakeApiClient(
      methodAwareHandler: (uri, method) async {
        if (uri.path.endsWith('/listings') &&
            uri.queryParameters['scope'] == 'mine') {
          expect(uri.queryParameters['status'], 'DRAFT');
          return managedListingPageJson();
        }
        if (method == 'POST' && uri.path.endsWith('/publish')) {
          return managedListingJson(status: 'PENDING_REVIEW');
        }
        return catalogHandler(uri);
      },
    );
    final repo = await listings(client);
    final page = await repo.list(status: 'DRAFT');
    expect(page.items.single.status, 'DRAFT');
    final published = await repo.publish(testManagedListingId);
    expect(published.status, 'PENDING_REVIEW');
  });

  test('refuse un identifiant d\'annonce invalide avant l\'appel', () async {
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    final repo = await listings(client);
    await expectLater(
      repo.publish('pas-un-uuid'),
      throwsA(isA<InvalidListingIdFailure>()),
    );
    expect(client.calls, 0);
  });

  test('charge le tableau de bord CRM et une fiche prospect', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.endsWith('/inquiries/dashboard')) {
          return inquiryDashboardJson(unhandled: 4);
        }
        if (uri.path.endsWith('/inquiries')) {
          expect(uri.queryParameters['stage'], 'NEW');
          return inquiryPageJson();
        }
        return catalogHandler(uri);
      },
    );
    final repo = await inquiries(client);
    final dashboard = await repo.dashboard();
    expect(dashboard.unhandled, 4);
    expect(dashboard.responseRate, isNull);
    final page = await repo.list(stage: 'NEW');
    expect(page.items.single.prospect.displayName, 'Koffi Yao');
    final detail = await repo.getById(testInquiryId);
    expect(detail.id, testInquiryId);
  });

  test('refuse un identifiant de demande invalide', () async {
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    final repo = await inquiries(client);
    await expectLater(
      repo.getById('pas-un-uuid'),
      throwsA(isA<InvalidInquiryIdFailure>()),
    );
    expect(client.calls, 0);
  });

  test('met à jour le stage et ajoute une note interne', () async {
    final client = FakeApiClient(
      methodAwareHandler: (uri, method) async {
        if (method == 'PATCH') {
          return inquiryJson(stage: 'CONTACTED');
        }
        if (method == 'POST' && uri.path.endsWith('/notes')) {
          return inquiryJson(
            notes: [
              {
                'id': '14141414-1414-1414-1414-141414141414',
                'body': 'Relancer demain',
                'createdAt': '2026-10-29T10:00:00.000Z',
                'author': {'id': testProspectId, 'displayName': 'Awa'},
              },
            ],
          );
        }
        return catalogHandler(uri);
      },
    );
    final repo = await inquiries(client);
    final updated = await repo.updateStage(
      inquiryId: testInquiryId,
      stage: 'CONTACTED',
    );
    expect(updated.stage, 'CONTACTED');
    expect(client.lastBody?['stage'], 'CONTACTED');
    final noted = await repo.addNote(
      inquiryId: testInquiryId,
      body: 'Relancer demain',
    );
    expect(noted.notes.single.body, 'Relancer demain');
    expect(client.lastBody?['body'], 'Relancer demain');
  });

  test('traduit un 404 prospect en indisponible', () async {
    final client = FakeApiClient(
      handler: (_) async =>
          throw const HttpFailure(message: 'absent', statusCode: 404),
    );
    final repo = await inquiries(client);
    await expectLater(
      repo.getById(testInquiryId),
      throwsA(isA<InquiryUnavailableFailure>()),
    );
  });

  test('charge GET /analytics/me/listings', () async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'access', refreshToken: 'refresh'),
    );
    final client = FakeApiClient(
      handler: (uri) async {
        expect(uri.path.endsWith('/analytics/me/listings'), isTrue);
        expect(uri.queryParameters['from'], isNotNull);
        return listingStatsPageJson();
      },
    );
    final repo = PublisherAnalyticsRepository(
      client: client,
      endpoints: endpoints,
      sessionStore: store,
    );
    final page = await repo.myListings(
      from: DateTime.utc(2026, 9, 29),
      to: DateTime.utc(2026, 10, 29),
    );
    expect(page.detailViews, 12);
  });
}
