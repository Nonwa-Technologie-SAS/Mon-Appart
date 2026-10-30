import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/listing/recommendation_feed.dart';
import 'package:mon_appart/features/home/data/recommendation_repository.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/listing_fixtures.dart';

void main() {
  final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));

  test('appelle GET /api/v1/recommendations', () async {
    final client = FakeApiClient(
      handler: (uri) async {
        expect(uri.path, '/api/v1/recommendations');
        expect(uri.queryParameters['limit'], '8');
        return recommendationResponseJson(level: 'GENERIC');
      },
    );
    final repo = RecommendationRepository(client: client, endpoints: endpoints);
    final feed = await repo.fetchFeed();
    expect(feed.level, RecommendationLevel.generic);
    expect(feed.items, isNotEmpty);
  });
}
