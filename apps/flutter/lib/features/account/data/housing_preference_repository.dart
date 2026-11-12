import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/json/json_map.dart';
import '../../../core/offline/cache_read.dart';
import '../../../core/offline/cached_envelope.dart';
import '../../../core/offline/offline_cache.dart';
import '../domain/housing_preferences.dart';

class HousingPreferenceRepository {
  HousingPreferenceRepository({
    required this.client,
    required this.endpoints,
    this.cache,
  });

  final ApiClient client;
  final ApiEndpoints endpoints;
  final OfflineCache? cache;

  Future<HousingPreferences> get() async {
    final read = await readPreferences();
    return read.value;
  }

  Future<CachedRead<HousingPreferences>> readPreferences() async {
    final local = cache;
    final userId = asNonEmptyString((await local?.getProfile())?.payload['id']);
    if (local == null || userId == null) {
      return CachedRead(
        value: HousingPreferences.fromJson(
          await client.getJson(endpoints.recommendationPreferences()),
        ),
        fetchedAt: DateTime.now().toUtc(),
        fromCache: false,
      );
    }
    return readThroughCache(
      remote: () => client.getJson(endpoints.recommendationPreferences()),
      persist: (json) => local.putPreferences(userId, json),
      local: () => local.getPreferences(userId),
      parse: HousingPreferences.fromJson,
      now: () => local.now,
    );
  }

  Future<HousingPreferences> replace(HousingPreferences preferences) async {
    final json = await client.putJson(
      endpoints.recommendationPreferences(),
      body: preferences.toPutBody(),
    );
    final userId = asNonEmptyString((await cache?.getProfile())?.payload['id']);
    if (userId != null) {
      await cache?.putPreferences(userId, json);
    }
    return HousingPreferences.fromJson(json);
  }
}
