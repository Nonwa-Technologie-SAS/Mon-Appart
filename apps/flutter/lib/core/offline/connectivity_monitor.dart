import '../errors/app_failure.dart';
import 'connectivity_status.dart';
import 'sync_rules.dart';

typedef HealthProbe = Future<bool> Function();

/// Vérité réseau = résultat API / [GET /health/live], pas le type Wi‑Fi.
class ConnectivityMonitor {
  ConnectivityMonitor({DateTime Function()? clock, this.probe})
    : _now = clock ?? DateTime.now;

  HealthProbe? probe;
  final DateTime Function() _now;

  ConnectivitySnapshot snapshot = ConnectivitySnapshot.initial;
  final _listeners = <void Function(ConnectivitySnapshot)>[];

  DateTime get now => _now().toUtc();

  void addListener(void Function(ConnectivitySnapshot snapshot) listener) {
    _listeners.add(listener);
  }

  void removeListener(void Function(ConnectivitySnapshot snapshot) listener) {
    _listeners.remove(listener);
  }

  void setPendingCount(int count) {
    _emit(snapshot.copyWith(pendingCount: count));
  }

  void recordSuccess() {
    _emit(
      snapshot.copyWith(
        kind: ConnectivityKind.online,
        lastSuccessAt: now,
        clearMessage: true,
      ),
    );
  }

  void recordFailure(AppFailure failure) {
    if (SyncRules.isUnauthenticated(failure)) {
      return;
    }
    if (!SyncRules.isTransient(failure) && failure is! HttpFailure) {
      return;
    }
    if (!SyncRules.isTransient(failure)) {
      return;
    }
    final kind = failure is TimeoutFailure
        ? ConnectivityKind.unreachable
        : ConnectivityKind.offline;
    _emit(
      snapshot.copyWith(
        kind: kind,
        lastFailureAt: now,
        message: failure.message,
      ),
    );
  }

  Future<bool> checkBackend() async {
    final runner = probe;
    if (runner == null) {
      return snapshot.isOnline;
    }
    try {
      final ok = await runner();
      _emit(
        snapshot.copyWith(
          kind: ok ? ConnectivityKind.online : ConnectivityKind.unreachable,
          lastProbeAt: now,
          lastSuccessAt: ok ? now : snapshot.lastSuccessAt,
          lastFailureAt: ok ? snapshot.lastFailureAt : now,
          clearMessage: ok,
          message: ok ? null : 'Le serveur Mon Appart ne répond pas.',
        ),
      );
      return ok;
    } on AppFailure catch (error) {
      recordFailure(error);
      _emit(snapshot.copyWith(lastProbeAt: now));
      return false;
    } catch (_) {
      _emit(
        snapshot.copyWith(
          kind: ConnectivityKind.unreachable,
          lastProbeAt: now,
          lastFailureAt: now,
          message: 'Le serveur Mon Appart ne répond pas.',
        ),
      );
      return false;
    }
  }

  void _emit(ConnectivitySnapshot next) {
    snapshot = next;
    for (final listener in List.of(_listeners)) {
      listener(next);
    }
  }
}
