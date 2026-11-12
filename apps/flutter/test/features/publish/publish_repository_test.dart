import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/features/pro/data/pro_listings_repository.dart';
import 'package:mon_appart/features/publish/data/media_upload_repository.dart';
import 'package:mon_appart/features/publish/data/property_repository.dart';
import 'package:mon_appart/features/publish/data/publish_catalog_repository.dart';
import 'package:mon_appart/features/publish/domain/publish_draft.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/pro_fixtures.dart';

void main() {
  final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));

  Future<PropertyRepository> properties(FakeApiClient client) async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'access', refreshToken: 'refresh'),
    );
    return PropertyRepository(
      client: client,
      endpoints: endpoints,
      sessionStore: store,
    );
  }

  test('crée un bien DRAFT sans envoyer un prix nul', () async {
    final client = FakeApiClient(
      methodAwareHandler: (uri, method) async {
        expect(method, 'POST');
        expect(uri.path, '/api/v1/properties');
        return managedPropertyJson(title: 'Villa Riviera');
      },
    );
    final repo = await properties(client);
    final created = await repo.create(
      const PublishDraft(
        listingType: 'RENT',
        propertyType: 'VILLA',
        title: 'Villa Riviera',
        communeCode: 'COCODY',
        neighborhoodCode: 'RIVIERA',
      ),
    );
    expect(created.status, 'DRAFT');
    expect(client.lastBody?['title'], 'Villa Riviera');
    expect(client.lastBody?.containsKey('price'), isFalse);
  });

  test('n\'appelle pas Nest sans session', () async {
    final client = FakeApiClient(handler: (uri) async => managedPropertyJson());
    final repo = PropertyRepository(
      client: client,
      endpoints: endpoints,
      sessionStore: InMemorySessionStore(),
    );
    await expectLater(
      repo.create(const PublishDraft(title: 'x', propertyType: 'VILLA')),
      throwsA(isA<NeedsAuthFailure>()),
    );
    expect(client.calls, 0);
  });

  test('upload média : session, PUT exact, complete', () async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'access', refreshToken: 'refresh'),
    );
    final bytes = [0xFF, 0xD8, 0xFF, 0x01];
    final client = FakeApiClient(
      methodAwareHandler: (uri, method) async {
        if (method == 'POST' && uri.path.endsWith('/media/upload-sessions')) {
          return {
            'sessionId': '55555555-5555-4555-8555-555555555555',
            'mediaId': '44444444-4444-4444-4444-444444444444',
            'upload': {
              'url': 'http://storage.test/object',
              'method': 'PUT',
              'headers': {'Content-Type': 'image/jpeg'},
              'contentLength': bytes.length,
              'expiresAt': '2026-10-29T12:00:00.000Z',
            },
          };
        }
        if (method == 'POST' && uri.path.endsWith('/complete')) {
          return {
            'sessionId': '55555555-5555-4555-8555-555555555555',
            'media': {
              'id': '44444444-4444-4444-4444-444444444444',
              'type': 'IMAGE',
              'sortOrder': 0,
              'url': 'https://cdn.example/photo.jpg',
              'isPrimary': true,
            },
          };
        }
        throw const ParsingFailure();
      },
    );
    final repo = MediaUploadRepository(
      client: client,
      endpoints: endpoints,
      sessionStore: store,
    );
    final item = await repo.uploadImage(
      propertyId: testManagedPropertyId,
      bytes: bytes,
      mimeType: 'image/jpeg',
      filename: 'salon.jpg',
    );
    expect(client.lastPutBytesUri, Uri.parse('http://storage.test/object'));
    expect(client.lastPutBytes, bytes);
    expect(client.lastPutHeaders?['Content-Type'], 'image/jpeg');
    expect(item.id, '44444444-4444-4444-4444-444444444444');
    expect(item.isPrimary, isTrue);
  });

  test('crée une annonce DRAFT avec prix optionnel', () async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'access', refreshToken: 'refresh'),
    );
    final client = FakeApiClient(
      methodAwareHandler: (uri, method) async {
        expect(method, 'POST');
        return managedListingJson();
      },
    );
    final repo = ProListingsRepository(
      client: client,
      endpoints: endpoints,
      sessionStore: store,
    );
    final listing = await repo.create(
      propertyId: testManagedPropertyId,
      listingType: 'RENT',
      title: 'Appartement 2 chambres à Cocody',
      amount: 350000,
      period: 'MONTH',
    );
    expect(listing.status, 'DRAFT');
    expect(client.lastBody?['propertyId'], testManagedPropertyId);
    expect(client.lastBody?['price'], {
      'amount': 350000,
      'period': 'MONTH',
      'currency': 'XOF',
    });
  });

  test('catalogue : repli seed si GET tableau illisible', () async {
    final client = FakeApiClient();
    final repo = PublishCatalogRepository(client: client, endpoints: endpoints);
    final types = await repo.propertyTypes();
    expect(types.map((item) => item.code), contains('APARTMENT'));
  });
}
