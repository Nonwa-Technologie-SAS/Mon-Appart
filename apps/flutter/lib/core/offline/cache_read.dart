import '../errors/app_failure.dart';
import 'cached_envelope.dart';
import 'sync_rules.dart';

Future<CachedRead<T>> readThroughCache<T>({
  required Future<Map<String, Object?>> Function() remote,
  required Future<void> Function(Map<String, Object?> json) persist,
  required Future<CachedEnvelope?> Function() local,
  required T Function(Map<String, Object?> json) parse,
  required DateTime Function() now,
}) async {
  try {
    final json = await remote();
    await persist(json);
    return CachedRead(
      value: parse(json),
      fetchedAt: now().toUtc(),
      fromCache: false,
    );
  } on AppFailure catch (error) {
    if (!SyncRules.isTransient(error)) {
      rethrow;
    }
    final cached = await local();
    if (cached == null) {
      rethrow;
    }
    return CachedRead(
      value: parse(cached.payload),
      fetchedAt: cached.fetchedAt,
      fromCache: true,
    );
  }
}
