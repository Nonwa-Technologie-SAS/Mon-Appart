import '../../../app/config/api_endpoints.dart';
import '../../../core/api/api_client.dart';
import '../../../core/auth/session_store.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/json/json_map.dart';
import '../../../core/offline/cache_read.dart';
import '../../../core/offline/cached_envelope.dart';
import '../../../core/offline/offline_cache.dart';
import '../../favorites/domain/favorite_item.dart';

class FavoriteRepository {
  FavoriteRepository({
    required this.client,
    required this.endpoints,
    required this.sessionStore,
    this.cache,
  });

  final ApiClient client;
  final ApiEndpoints endpoints;
  final SessionStore sessionStore;
  final OfflineCache? cache;

  Future<bool> get hasSession async {
    final token = await sessionStore.readAccessToken();
    return token != null && token.isNotEmpty;
  }

  Future<List<FavoriteItem>> list() async {
    final read = await readList();
    return read.value;
  }

  Future<CachedRead<List<FavoriteItem>>> readList() async {
    await _requireSession();
    final local = cache;
    final userId = asNonEmptyString((await local?.getProfile())?.payload['id']);
    if (local == null || userId == null) {
      return CachedRead(
        value: _parseItems(await client.getJson(endpoints.favorites())),
        fetchedAt: DateTime.now().toUtc(),
        fromCache: false,
      );
    }
    return readThroughCache(
      remote: () => client.getJson(endpoints.favorites()),
      persist: (json) => local.putFavorites(userId, json),
      local: () => local.getFavorites(userId),
      parse: _parseItems,
      now: () => local.now,
    );
  }

  static List<FavoriteItem> _parseItems(Map<String, Object?> json) {
    final raw = json['items'];
    if (raw is! List) {
      return const [];
    }
    return [for (final item in raw) ?FavoriteItem.tryParse(item)];
  }

  Future<bool?> isFavorite(String listingId) async {
    if (!await hasSession) {
      return null;
    }
    final json = await client.getJson(endpoints.favorite(listingId));
    return json['favorited'] == true;
  }

  Future<bool> add(String listingId) async {
    await _requireSession();
    final json = await client.postJson(endpoints.favorite(listingId));
    return json['favorited'] != false;
  }

  Future<bool> remove(String listingId) async {
    await _requireSession();
    final json = await client.deleteJson(endpoints.favorite(listingId));
    return json['favorited'] == true;
  }

  Future<void> _requireSession() async {
    if (!await hasSession) {
      throw const FavoriteNeedsAuthFailure();
    }
  }
}
