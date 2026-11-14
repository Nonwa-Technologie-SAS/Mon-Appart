import '../observability/telemetry_client.dart';
import '../offline/offline_cache.dart';
import '../offline/pending_queue.dart';

/// Efface le cache privé du compte encore présent sur l'appareil.
///
/// Les annonces publiques restent. Les jetons restent dans le trousseau.
class PrivateSessionCleaner {
  Future<String?> forget({
    required OfflineCache cache,
    required PendingQueue queue,
    TelemetryClient? telemetry,
  }) async {
    final userId = await cache.cachedUserId();
    if (userId != null) {
      await cache.clearUser(userId);
      await queue.clearUser(userId);
    } else {
      await cache.clearSessionProfile();
    }
    if (telemetry != null) {
      await telemetry.discardIncidents();
    }
    return userId;
  }
}
