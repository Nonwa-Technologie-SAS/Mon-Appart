import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/listing/search_page.dart';
import '../../../core/offline/cache_read.dart';
import '../../../core/offline/cached_envelope.dart';
import '../../../core/offline/offline_cache.dart';
import '../../../core/search/explore_query.dart';

/// `GET /api/v1/search` — OptionalAuth, pagination curseur Nest.
class SearchRepository {
  SearchRepository({required this.client, required this.endpoints, this.cache});

  final ApiClient client;
  final ApiEndpoints endpoints;
  final OfflineCache? cache;

  Future<SearchPage> search(
    ExploreQuery query, {
    String? cursor,
    bool submit = false,
  }) async {
    try {
      final json = await client.getJson(
        endpoints.search(),
        query: query.toApiQuery(cursor: cursor, submit: submit),
      );
      return SearchPage.fromJson(json);
    } on AppFailure {
      rethrow;
    } on FormatException catch (error) {
      throw ParsingFailure(message: error.message);
    }
  }

  /// Accueil uniquement : pas un cache de tout le catalogue.
  Future<CachedRead<SearchPage>> readHomeLatest(ExploreQuery query) async {
    final local = cache;
    if (local == null) {
      return CachedRead(
        value: await search(query),
        fetchedAt: DateTime.now().toUtc(),
        fromCache: false,
      );
    }
    return readThroughCache(
      remote: () =>
          client.getJson(endpoints.search(), query: query.toApiQuery()),
      persist: local.putHomeLatest,
      local: local.getHomeLatest,
      parse: SearchPage.fromJson,
      now: () => local.now,
    );
  }
}
