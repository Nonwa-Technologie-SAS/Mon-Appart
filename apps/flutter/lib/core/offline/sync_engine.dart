import '../errors/app_failure.dart';
import 'offline_policy.dart';
import 'pending_operation.dart';
import 'pending_queue.dart';
import 'sync_rules.dart';

class SyncHandlers {
  const SyncHandlers({
    required this.favoriteAdd,
    required this.favoriteRemove,
    required this.preferencesPut,
  });

  final Future<void> Function(String listingId) favoriteAdd;
  final Future<void> Function(String listingId) favoriteRemove;
  final Future<void> Function(Map<String, Object?> body) preferencesPut;
}

class SyncReport {
  const SyncReport({
    this.synced = 0,
    this.failedTemporary = 0,
    this.failedPermanent = 0,
    this.skipped = 0,
    this.stoppedForAuth = false,
  });

  final int synced;
  final int failedTemporary;
  final int failedPermanent;
  final int skipped;
  final bool stoppedForAuth;
}

/// Rejoue la file. Une opération n'est « synchronisée » qu'après réponse Nest.
class SyncEngine {
  SyncEngine({required this.queue, DateTime Function()? clock})
    : _now = clock ?? DateTime.now;

  final PendingQueue queue;
  final DateTime Function() _now;

  DateTime get now => _now().toUtc();

  Future<SyncReport> drain({
    required String userId,
    required SyncHandlers handlers,
  }) async {
    var synced = 0;
    var failedTemporary = 0;
    var failedPermanent = 0;
    var skipped = 0;
    var stoppedForAuth = false;
    final ops = await queue.openFor(userId);
    for (final op in ops) {
      if (stoppedForAuth) {
        skipped += 1;
        continue;
      }
      if (op.nextAttemptAt != null && op.nextAttemptAt!.isAfter(now)) {
        skipped += 1;
        continue;
      }
      final running = op.copyWith(
        status: PendingOpStatus.running,
        lastAttemptAt: now,
        attempts: op.attempts + 1,
      );
      await queue.replace(running);
      try {
        await _execute(running, handlers);
        await queue.remove(running.id);
        synced += 1;
      } on AppFailure catch (error) {
        if (SyncRules.isUnauthenticated(error)) {
          await queue.replace(
            running.copyWith(
              status: PendingOpStatus.failedPermanent,
              lastError: error.message,
            ),
          );
          failedPermanent += 1;
          stoppedForAuth = true;
          continue;
        }
        if (SyncRules.isTransient(error) &&
            running.attempts < OfflinePolicy.maxRetries) {
          await queue.replace(
            running.copyWith(
              status: PendingOpStatus.failedTemporary,
              nextAttemptAt: SyncRules.nextAttempt(running.attempts, now: now),
              lastError: error.message,
            ),
          );
          failedTemporary += 1;
          continue;
        }
        await queue.replace(
          running.copyWith(
            status: PendingOpStatus.failedPermanent,
            lastError: error.message,
          ),
        );
        failedPermanent += 1;
      }
    }
    return SyncReport(
      synced: synced,
      failedTemporary: failedTemporary,
      failedPermanent: failedPermanent,
      skipped: skipped,
      stoppedForAuth: stoppedForAuth,
    );
  }

  Future<void> _execute(PendingOperation op, SyncHandlers handlers) {
    switch (op.type) {
      case PendingOpType.favoriteAdd:
        return handlers.favoriteAdd(op.entityId);
      case PendingOpType.favoriteRemove:
        return handlers.favoriteRemove(op.entityId);
      case PendingOpType.preferencesPut:
        return handlers.preferencesPut(op.payload);
    }
  }
}
