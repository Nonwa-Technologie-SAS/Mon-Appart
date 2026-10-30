import '../json/json_map.dart';
import 'cached_envelope.dart';
import 'key_value_store.dart';
import 'offline_json.dart';
import 'offline_policy.dart';

/// Cache applicatif. Les secrets ne passent pas ici.
class OfflineCache {
  OfflineCache({required this._store, DateTime Function()? clock})
    : _now = clock ?? DateTime.now;

  static const _listingIndex = 'public/listing-index';
  static const _homeLatest = 'public/home/latest';
  static const _homeRecos = 'public/home/recommendations';
  static const _sessionProfile = 'session/profile';

  final KeyValueStore _store;
  final DateTime Function() _now;

  DateTime get now => _now().toUtc();

  Future<void> putEnvelope(String key, Map<String, Object?> payload) {
    final safe = jsonSafe(payload);
    final map = <String, Object?>{};
    if (safe is Map) {
      safe.forEach((itemKey, value) {
        map[itemKey.toString()] = value;
      });
    }
    final envelope = CachedEnvelope(payload: map, fetchedAt: now);
    return _store.write(key, envelope.encode());
  }

  Future<CachedEnvelope?> getEnvelope(String key) async {
    return CachedEnvelope.tryParse(await _store.read(key));
  }

  Future<void> putListing(String listingId, Map<String, Object?> json) async {
    await putEnvelope(_listingKey(listingId), json);
    await _touchListingIndex(listingId);
  }

  Future<CachedEnvelope?> getListing(String listingId) {
    return getEnvelope(_listingKey(listingId));
  }

  Future<void> putHomeLatest(Map<String, Object?> json) {
    return putEnvelope(_homeLatest, json);
  }

  Future<CachedEnvelope?> getHomeLatest() => getEnvelope(_homeLatest);

  Future<void> putHomeRecommendations(Map<String, Object?> json) {
    return putEnvelope(_homeRecos, json);
  }

  Future<CachedEnvelope?> getHomeRecommendations() => getEnvelope(_homeRecos);

  Future<void> putProfile(Map<String, Object?> json) async {
    await putEnvelope(_sessionProfile, json);
    final userId = asNonEmptyString(json['id']);
    if (userId != null) {
      await putEnvelope(_userKey(userId, 'profile'), json);
    }
  }

  Future<CachedEnvelope?> getProfile() => getEnvelope(_sessionProfile);

  Future<void> putFavorites(String userId, Map<String, Object?> json) {
    return putEnvelope(_userKey(userId, 'favorites'), json);
  }

  Future<CachedEnvelope?> getFavorites(String userId) {
    return getEnvelope(_userKey(userId, 'favorites'));
  }

  Future<void> putVisits(
    String userId,
    String scope,
    Map<String, Object?> json,
  ) {
    return putEnvelope(_userKey(userId, 'visits/$scope'), json);
  }

  Future<CachedEnvelope?> getVisits(String userId, String scope) {
    return getEnvelope(_userKey(userId, 'visits/$scope'));
  }

  Future<void> putVisit(
    String userId,
    String visitId,
    Map<String, Object?> json,
  ) {
    return putEnvelope(_userKey(userId, 'visit/$visitId'), json);
  }

  Future<CachedEnvelope?> getVisit(String userId, String visitId) {
    return getEnvelope(_userKey(userId, 'visit/$visitId'));
  }

  Future<void> putSavedSearches(String userId, Map<String, Object?> json) {
    return putEnvelope(_userKey(userId, 'saved-searches'), json);
  }

  Future<CachedEnvelope?> getSavedSearches(String userId) {
    return getEnvelope(_userKey(userId, 'saved-searches'));
  }

  Future<void> putPreferences(String userId, Map<String, Object?> json) {
    return putEnvelope(_userKey(userId, 'preferences'), json);
  }

  Future<CachedEnvelope?> getPreferences(String userId) {
    return getEnvelope(_userKey(userId, 'preferences'));
  }

  Future<void> putShortlist(String scope, List<Map<String, Object?>> items) {
    return putEnvelope(_shortlistKey(scope), {'items': items});
  }

  Future<List<Map<String, Object?>>> getShortlist(String scope) async {
    final envelope = await getEnvelope(_shortlistKey(scope));
    final raw = envelope?.payload['items'];
    if (raw is! List) {
      return const [];
    }
    return [
      for (final item in raw)
        if (asJsonMapOrNull(item) != null) asJsonMap(item),
    ];
  }

  Future<void> clearSessionProfile() => _store.delete(_sessionProfile);

  Future<void> clearUser(String userId) async {
    await _store.deleteByPrefix('user/$userId/');
    final profile = await getProfile();
    final cachedId = asNonEmptyString(profile?.payload['id']);
    if (cachedId == userId) {
      await clearSessionProfile();
    }
  }

  static String scopeOf(String? userId) {
    if (userId == null || userId.isEmpty) {
      return OfflinePolicy.guestScope;
    }
    return userId;
  }

  static String _listingKey(String listingId) => 'public/listings/$listingId';

  static String _userKey(String userId, String suffix) =>
      'user/$userId/$suffix';

  static String _shortlistKey(String scope) => scope == OfflinePolicy.guestScope
      ? 'anon/shortlist'
      : _userKey(scope, 'shortlist');

  Future<void> _touchListingIndex(String listingId) async {
    final raw = await _store.read(_listingIndex);
    final ids = <String>[listingId];
    if (raw != null) {
      try {
        final decoded = decodeJsonObject(raw);
        final existing = decoded['ids'];
        if (existing is List) {
          for (final item in existing) {
            final id = asNonEmptyString(item);
            if (id != null && id != listingId) {
              ids.add(id);
            }
          }
        }
      } on FormatException {
        // index reconstruit
      }
    }
    final kept = ids.take(OfflinePolicy.maxListings).toList();
    final dropped = ids.skip(OfflinePolicy.maxListings);
    for (final id in dropped) {
      await _store.delete(_listingKey(id));
    }
    final cutoff = now.subtract(OfflinePolicy.listingRetention);
    final retained = <String>[];
    for (final id in kept) {
      final envelope = await getListing(id);
      if (envelope == null || envelope.fetchedAt.isBefore(cutoff)) {
        await _store.delete(_listingKey(id));
        continue;
      }
      retained.add(id);
    }
    await _store.write(_listingIndex, encodeJsonObject({'ids': retained}));
  }
}
