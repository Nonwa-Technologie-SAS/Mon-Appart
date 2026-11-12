import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'connectivity_monitor.dart';
import 'connectivity_status.dart';
import 'key_value_store.dart';
import 'memory_key_value_store.dart';
import 'offline_cache.dart';
import 'pending_queue.dart';
import 'sync_engine.dart';

final keyValueStoreProvider = Provider<KeyValueStore>((ref) {
  return MemoryKeyValueStore();
});

final offlineClockProvider = Provider<DateTime Function()>((ref) {
  return DateTime.now;
});

final offlineCacheProvider = Provider<OfflineCache>((ref) {
  return OfflineCache(
    store: ref.watch(keyValueStoreProvider),
    clock: ref.watch(offlineClockProvider),
  );
});

final pendingQueueProvider = Provider<PendingQueue>((ref) {
  return PendingQueue(
    store: ref.watch(keyValueStoreProvider),
    clock: ref.watch(offlineClockProvider),
  );
});

final connectivityMonitorProvider = Provider<ConnectivityMonitor>((ref) {
  final monitor = ConnectivityMonitor(clock: ref.watch(offlineClockProvider));
  ref.onDispose(() {
    monitor.probe = null;
  });
  return monitor;
});

final syncEngineProvider = Provider<SyncEngine>((ref) {
  return SyncEngine(
    queue: ref.watch(pendingQueueProvider),
    clock: ref.watch(offlineClockProvider),
  );
});

class SyncEpoch extends Notifier<int> {
  @override
  int build() => 0;

  void bump() => state++;
}

final syncEpochProvider = NotifierProvider<SyncEpoch, int>(SyncEpoch.new);

class ConnectivityController extends Notifier<ConnectivitySnapshot> {
  @override
  ConnectivitySnapshot build() {
    final monitor = ref.watch(connectivityMonitorProvider);
    void onChange(ConnectivitySnapshot next) {
      state = next;
    }

    monitor.addListener(onChange);
    ref.onDispose(() => monitor.removeListener(onChange));
    return monitor.snapshot;
  }

  Future<bool> probe() {
    return ref.read(connectivityMonitorProvider).checkBackend();
  }
}

final connectivityControllerProvider =
    NotifierProvider<ConnectivityController, ConnectivitySnapshot>(
      ConnectivityController.new,
    );
