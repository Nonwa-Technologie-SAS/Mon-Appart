import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/core/search/explore_query.dart';
import 'package:mon_appart/features/explore/data/search_repository.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/listing_fixtures.dart';

void main() {
  final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));

  test('appelle GET /api/v1/search avec les filtres', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        expect(uri.path, '/api/v1/search');
        expect(uri.queryParameters['listingType'], 'RENT');
        expect(uri.queryParameters['sort'], 'NEWEST');
        expect(uri.queryParameters['minPrice'], '100000');
        return searchResponseJson();
      },
    );
    final repo = SearchRepository(client: client, endpoints: endpoints);
    final page = await repo.search(
      const ExploreQuery(
        listingType: 'RENT',
        sort: 'NEWEST',
        minPrice: 100000,
        limit: 5,
      ),
    );
    expect(page.items, hasLength(1));
    expect(page.items.first.listingType, 'RENT');
  });

  test('transmet le curseur sans revalider submit', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        expect(uri.queryParameters['cursor'], 'page-2');
        expect(uri.queryParameters.containsKey('submit'), isFalse);
        return searchResponseJson();
      },
    );
    final repo = SearchRepository(client: client, endpoints: endpoints);
    await repo.search(
      const ExploreQuery(listingType: 'RENT'),
      cursor: 'page-2',
    );
  });

  test('propage une erreur réseau', () async {
    final client = FakeApiClient(
      handler: (_) async => throw const NetworkFailure(),
    );
    final repo = SearchRepository(client: client, endpoints: endpoints);
    await expectLater(
      repo.search(const ExploreQuery()),
      throwsA(isA<NetworkFailure>()),
    );
  });
}
