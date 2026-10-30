import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/listing/recommendation_feed.dart';
import '../../../core/offline/cache_read.dart';
import '../../../core/offline/cached_envelope.dart';
import '../../../core/offline/offline_cache.dart';

/// `GET /api/v1/recommendations` — OptionalAuth.
///
/// Le classement reste côté Nest. Le client n'invente pas de score.
class RecommendationRepository {
  RecommendationRepository({
    required this.client,
    required this.endpoints,
    this.cache,
  });

  final ApiClient client;
  final ApiEndpoints endpoints;
  final OfflineCache? cache;

  Future<RecommendationFeed> fetchFeed({int limit = 8}) async {
    try {
      final json = await client.getJson(
        endpoints.recommendations(),
        query: {'limit': '$limit'},
      );
      return RecommendationFeed.fromJson(json);
    } on AppFailure {
      rethrow;
    } on FormatException catch (error) {
      throw ParsingFailure(message: error.message);
    }
  }

  Future<CachedRead<RecommendationFeed>> readHomeFeed({int limit = 8}) async {
    final local = cache;
    if (local == null) {
      return CachedRead(
        value: await fetchFeed(limit: limit),
        fetchedAt: DateTime.now().toUtc(),
        fromCache: false,
      );
    }
    return readThroughCache(
      remote: () => client.getJson(
        endpoints.recommendations(),
        query: {'limit': '$limit'},
      ),
      persist: local.putHomeRecommendations,
      local: local.getHomeRecommendations,
      parse: RecommendationFeed.fromJson,
      now: () => local.now,
    );
  }
}
