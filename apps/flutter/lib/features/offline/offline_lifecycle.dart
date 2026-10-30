import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'offline_runtime.dart';

final offlineLifecycleProvider = Provider<void>((ref) {
  final observer = _OfflineLifecycleObserver(ref);
  WidgetsBinding.instance.addObserver(observer);
  ref.onDispose(() => WidgetsBinding.instance.removeObserver(observer));
  WidgetsBinding.instance.addPostFrameCallback((_) {
    observer.resume();
  });
});

class _OfflineLifecycleObserver with WidgetsBindingObserver {
  _OfflineLifecycleObserver(this._ref);

  final Ref _ref;

  void resume() {
    _ref.read(offlineCoordinatorProvider).onForeground();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      resume();
    }
  }
}
