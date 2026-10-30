import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/auth/auth_session.dart';
import '../../core/errors/app_failure.dart';
import '../../core/offline/connectivity_status.dart';
import '../../core/offline/offline_providers.dart';
import '../../core/offline/sync_engine.dart';
import '../auth/presentation/auth_providers.dart';

final pendingCountProvider = FutureProvider<int>((ref) async {
  ref.watch(authControllerProvider);
  ref.watch(connectivityControllerProvider);
  final userId = ref.watch(authControllerProvider).value?.user?.id;
  if (userId == null) {
    return 0;
  }
  final open = await ref.watch(pendingQueueProvider).openFor(userId);
  return open.length;
});

class OfflineCoordinator {
  OfflineCoordinator(this._ref);

  final Ref _ref;
  var _draining = false;

  void attachProbe() {
    final monitor = _ref.read(connectivityMonitorProvider);
    if (_ref.read(appConfigProvider).apiBaseUrl == null) {
      return;
    }
    final health = _ref.read(healthRepositoryProvider);
    monitor.probe = () async {
      try {
        final live = await health.fetchLive();
        return live.isOk;
      } on AppFailure {
        return false;
      }
    };
  }

  Future<void> onForeground() async {
    if (_ref.read(appConfigProvider).apiBaseUrl == null) {
      return;
    }
    attachProbe();
    final monitor = _ref.read(connectivityMonitorProvider);
    if (monitor.snapshot.isOffline ||
        monitor.snapshot.kind == ConnectivityKind.unknown) {
      final online = await monitor.checkBackend();
      if (online) {
        await drain();
      }
      return;
    }
    await drain();
  }

  Future<void> drain() async {
    if (_draining) {
      return;
    }
    final session =
        _ref.read(authControllerProvider).value ?? AuthSession.signedOut();
    final userId = session.user?.id;
    final monitor = _ref.read(connectivityMonitorProvider);
    if (userId == null) {
      monitor.setPendingCount(0);
      return;
    }
    if (!monitor.snapshot.isOnline) {
      final pending = await _ref.read(pendingQueueProvider).openFor(userId);
      monitor.setPendingCount(pending.length);
      return;
    }
    _draining = true;
    try {
      final engine = _ref.read(syncEngineProvider);
      final endpoints = _ref.read(apiEndpointsProvider);
      final client = _ref.read(apiClientProvider);
      final report = await engine.drain(
        userId: userId,
        handlers: SyncHandlers(
          favoriteAdd: (listingId) async {
            await client.postJson(endpoints.favorite(listingId));
          },
          favoriteRemove: (listingId) async {
            await client.deleteJson(endpoints.favorite(listingId));
          },
          preferencesPut: (body) async {
            await client.putJson(
              endpoints.recommendationPreferences(),
              body: body,
            );
          },
        ),
      );
      final pending = await _ref.read(pendingQueueProvider).openFor(userId);
      monitor.setPendingCount(pending.length);
      if (report.synced > 0) {
        _ref.read(syncEpochProvider.notifier).bump();
      }
    } finally {
      _draining = false;
    }
  }

  Future<void> clearUser(String? userId) async {
    if (userId == null) {
      return;
    }
    await _ref.read(offlineCacheProvider).clearUser(userId);
    await _ref.read(pendingQueueProvider).clearUser(userId);
    _ref.read(connectivityMonitorProvider).setPendingCount(0);
  }
}

final offlineCoordinatorProvider = Provider<OfflineCoordinator>((ref) {
  return OfflineCoordinator(ref);
});
