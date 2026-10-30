import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/providers.dart';
import 'package:mon_appart/core/auth/in_memory_session_store.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/core/search/explore_query.dart';
import 'package:mon_appart/features/explore/presentation/explore_providers.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/listing_fixtures.dart';
import '../../helpers/test_app.dart';

const _firstId = '11111111-1111-1111-1111-111111111111';
const _secondId = '22222222-2222-2222-2222-222222222222';
const _query = ExploreQuery(listingType: 'RENT');

ProviderContainer _container(FakeApiClient client) {
  final container = ProviderContainer(
    overrides: [
      appConfigProvider.overrideWithValue(testConfig()),
      sessionStoreProvider.overrideWithValue(InMemorySessionStore()),
      apiClientProvider.overrideWithValue(client),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  test(
    'loadMore fusionne les pages et ignore un second appel concurrent',
    () async {
      var searchCalls = 0;
      final more = Completer<Map<String, Object?>>();
      final client = FakeApiClient(
        handler: (uri) {
          searchCalls += 1;
          if (uri.queryParameters['cursor'] == 'page-2') {
            return more.future;
          }
          return Future.value(
            searchResponseJson(nextCursor: 'page-2', hasMore: true),
          );
        },
      );
      final container = _container(client);
      container.listen(exploreControllerProvider(_query), (_, _) {});

      final first = await container.read(
        exploreControllerProvider(_query).future,
      );
      expect(first.items, hasLength(1));
      expect(first.items.single.listingId, _firstId);

      final notifier = container.read(
        exploreControllerProvider(_query).notifier,
      );
      final pending = notifier.loadMore();
      await notifier.loadMore();
      expect(searchCalls, 2);

      more.complete(
        searchResponseJson(
          items: [listingJson(id: _secondId, title: 'Villa à Marcory')],
        ),
      );
      await pending;

      final merged = container
          .read(exploreControllerProvider(_query))
          .requireValue;
      expect(merged.items.map((item) => item.listingId), [_firstId, _secondId]);
      expect(merged.hasMore, isFalse);
      expect(merged.loadingMore, isFalse);
    },
  );

  test(
    'une erreur de pagination conserve les résultats déjà chargés',
    () async {
      final client = FakeApiClient(
        handler: (uri) async {
          if (uri.queryParameters['cursor'] != null) {
            throw const NetworkFailure();
          }
          return searchResponseJson(nextCursor: 'page-2', hasMore: true);
        },
      );
      final container = _container(client);
      container.listen(exploreControllerProvider(_query), (_, _) {});
      await container.read(exploreControllerProvider(_query).future);

      await container
          .read(exploreControllerProvider(_query).notifier)
          .loadMore();

      final feed = container
          .read(exploreControllerProvider(_query))
          .requireValue;
      expect(feed.items, hasLength(1));
      expect(feed.loadMoreError, isA<NetworkFailure>());
      expect(feed.loadingMore, isFalse);
    },
  );

  test('une réponse obsolète ne remplace pas la recherche suivante', () async {
    final delayed = <Completer<Map<String, Object?>>>[];
    final client = FakeApiClient(
      handler: (uri) {
        final completer = Completer<Map<String, Object?>>();
        delayed.add(completer);
        return completer.future;
      },
    );
    final container = _container(client);
    container.listen(exploreControllerProvider(_query), (_, _) {});

    await Future<void>.delayed(Duration.zero);
    expect(delayed, hasLength(1));

    container.read(exploreControllerProvider(_query).notifier).retry();
    await Future<void>.delayed(Duration.zero);
    expect(delayed, hasLength(2));

    delayed[0].complete(searchResponseJson());
    delayed[1].complete(
      searchResponseJson(
        items: [listingJson(id: _secondId, title: 'Villa à Marcory')],
      ),
    );
    await container.read(exploreControllerProvider(_query).future);

    final feed = container.read(exploreControllerProvider(_query)).requireValue;
    expect(feed.items.single.listingId, _secondId);
    expect(feed.items.single.title, 'Villa à Marcory');
  });
}
