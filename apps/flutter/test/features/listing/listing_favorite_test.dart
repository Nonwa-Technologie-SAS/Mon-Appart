import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/auth/session_tokens.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/features/listing/data/favorite_repository.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/listing_fixtures.dart';

void main() {
  final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));
  const id = '11111111-1111-1111-1111-111111111111';

  test('sans session, aucun GET/POST/DELETE favori n\'est envoyé', () async {
    final client = FakeApiClient(handler: (uri) async => catalogHandler(uri));
    final repo = FavoriteRepository(
      client: client,
      endpoints: endpoints,
      sessionStore: InMemorySessionStore(),
    );
    expect(await repo.isFavorite(id), isNull);
    await expectLater(repo.add(id), throwsA(isA<FavoriteNeedsAuthFailure>()));
    await expectLater(
      repo.remove(id),
      throwsA(isA<FavoriteNeedsAuthFailure>()),
    );
    expect(client.calls, 0);
  });

  test('avec session, POST puis DELETE reflètent la réponse Nest', () async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'access', refreshToken: 'refresh'),
    );
    final client = FakeApiClient(
      handler: (uri) async {
        if (uri.path.contains('/interactions/favorites/')) {
          return const {'favorited': true};
        }
        return catalogHandler(uri);
      },
    );
    final repo = FavoriteRepository(
      client: client,
      endpoints: endpoints,
      sessionStore: store,
    );
    expect(await repo.add(id), isTrue);
    expect(client.methods, contains('POST'));
    expect(await repo.remove(id), isTrue);
    expect(client.methods, contains('DELETE'));
  });

  test('list parse uniquement listingId, titre et date Nest', () async {
    final store = InMemorySessionStore();
    await store.save(
      const SessionTokens(accessToken: 'access', refreshToken: 'refresh'),
    );
    final client = FakeApiClient(
      handler: (uri) async => {
        'items': [favoriteItemJson()],
      },
    );
    final repo = FavoriteRepository(
      client: client,
      endpoints: endpoints,
      sessionStore: store,
    );
    final items = await repo.list();
    expect(items.single.title, 'Appartement 2 chambres à Cocody');
    expect(items.single.listingId, id);
    expect(client.methods, ['GET']);
  });
}
