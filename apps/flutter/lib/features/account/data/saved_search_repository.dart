import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/json/json_map.dart';
import '../../../core/offline/cache_read.dart';
import '../../../core/offline/cached_envelope.dart';
import '../../../core/offline/offline_cache.dart';
import '../../../core/search/explore_query.dart';
import '../domain/saved_search_item.dart';

class SavedSearchRepository {
  SavedSearchRepository({
    required this.client,
    required this.endpoints,
    this.cache,
  });

  final ApiClient client;
  final ApiEndpoints endpoints;
  final OfflineCache? cache;

  Future<List<SavedSearchItem>> list() async {
    final read = await readList();
    return read.value;
  }

  Future<CachedRead<List<SavedSearchItem>>> readList() async {
    final local = cache;
    final userId = asNonEmptyString((await local?.getProfile())?.payload['id']);
    if (local == null || userId == null) {
      return CachedRead(
        value: _parseItems(await client.getJson(endpoints.savedSearches())),
        fetchedAt: DateTime.now().toUtc(),
        fromCache: false,
      );
    }
    return readThroughCache(
      remote: () => client.getJson(endpoints.savedSearches()),
      persist: (json) => local.putSavedSearches(userId, json),
      local: () => local.getSavedSearches(userId),
      parse: _parseItems,
      now: () => local.now,
    );
  }

  static List<SavedSearchItem> _parseItems(Map<String, Object?> json) {
    final raw = json['items'];
    if (raw is! List) {
      return const [];
    }
    return [for (final item in raw) ?SavedSearchItem.tryParse(item)];
  }

  Future<SavedSearchItem> create({
    required String name,
    required Map<String, String> params,
    bool alertsEnabled = true,
    String frequency = 'DAILY',
  }) async {
    final json = await client.postJson(
      endpoints.savedSearches(),
      body: {
        'name': name,
        'params': params,
        'alertsEnabled': alertsEnabled,
        'frequency': frequency,
      },
    );
    final item = SavedSearchItem.tryParse(json);
    if (item == null) {
      throw const ParsingFailure(
        message: 'La recherche enregistrée est incomplète.',
      );
    }
    return item;
  }

  Future<SavedSearchItem> update(
    String id, {
    String? name,
    Map<String, String>? params,
    bool? alertsEnabled,
    String? frequency,
  }) async {
    final json = await client.patchJson(
      endpoints.savedSearch(id),
      body: {
        'name': ?name,
        'params': ?params,
        'alertsEnabled': ?alertsEnabled,
        'frequency': ?frequency,
      },
    );
    final item = SavedSearchItem.tryParse(json);
    if (item == null) {
      throw const ParsingFailure(
        message: 'La recherche enregistrée est incomplète.',
      );
    }
    return item;
  }

  Future<ExploreQuery> resume(String id) async {
    final json = await client.postJson(endpoints.savedSearchResume(id));
    final params = <String, String>{};
    final raw = json['params'];
    if (raw is Map) {
      raw.forEach((key, value) {
        final text = asNonEmptyString(value);
        if (text != null) {
          params['$key'] = text;
        }
      });
    }
    return ExploreQuery.fromParams(params);
  }

  Future<void> remove(String id) async {
    await client.deleteJson(endpoints.savedSearch(id));
  }
}
