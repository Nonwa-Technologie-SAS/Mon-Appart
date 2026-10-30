import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/errors/app_failure.dart';
import '../data/os_notification_permission.dart';
import '../data/push_device_repository.dart';
import '../data/push_device_store.dart';
import '../domain/device_notification_permission.dart';
import '../domain/push_token_source.dart';

final pushTokenSourceProvider = Provider<PushTokenSource>((ref) {
  return const NullPushTokenSource();
});

final deviceNotificationPermissionProvider =
    Provider<DeviceNotificationPermission>((ref) {
      return const OsNotificationPermission();
    });

final pushDeviceStoreProvider = Provider<PushDeviceStore>((ref) {
  return SecurePushDeviceStore();
});

final pushDeviceRepositoryProvider = Provider<PushDeviceRepository>((ref) {
  return PushDeviceRepository(
    client: ref.watch(apiClientProvider),
    endpoints: ref.watch(apiEndpointsProvider),
  );
});

class PushCoordinator {
  PushCoordinator(this._ref);

  final Ref _ref;
  var _registering = false;

  Future<void> sync() async {
    if (_registering) {
      return;
    }
    final token = await _ref.read(pushTokenSourceProvider).currentToken();
    if (token == null || token.trim().length < 16) {
      return;
    }
    final access = await _ref.read(sessionStoreProvider).readAccessToken();
    if (access == null || access.isEmpty) {
      return;
    }
    final permission = await _ref
        .read(deviceNotificationPermissionProvider)
        .status();
    if (!permission.isGranted) {
      return;
    }
    _registering = true;
    try {
      final device = await _ref
          .read(pushDeviceRepositoryProvider)
          .register(token: token, platform: _platform());
      await _ref.read(pushDeviceStoreProvider).saveDeviceId(device.id);
    } on AppFailure {
      // Reprise au prochain cycle (connexion, permission, jeton).
    } finally {
      _registering = false;
    }
  }

  Future<void> unregisterQuietly() async {
    final store = _ref.read(pushDeviceStoreProvider);
    try {
      final id = await store.readDeviceId();
      if (id != null && id.isNotEmpty) {
        final access = await _ref.read(sessionStoreProvider).readAccessToken();
        if (access != null && access.isNotEmpty) {
          await _ref.read(pushDeviceRepositoryProvider).unregister(id);
        }
      }
    } catch (_) {
      // La déconnexion ne dépend pas du succès de cette requête.
    } finally {
      try {
        await store.clear();
      } catch (_) {}
    }
  }

  static String _platform() {
    if (!kIsWeb && Platform.isIOS) {
      return 'IOS';
    }
    if (!kIsWeb && Platform.isAndroid) {
      return 'ANDROID';
    }
    return 'WEB';
  }
}

final pushCoordinatorProvider = Provider<PushCoordinator>((ref) {
  return PushCoordinator(ref);
});

class NotificationPermissionController
    extends AsyncNotifier<NotificationPermissionState> {
  @override
  Future<NotificationPermissionState> build() {
    return ref.read(deviceNotificationPermissionProvider).status();
  }

  Future<void> request() async {
    final next = await ref.read(deviceNotificationPermissionProvider).request();
    state = AsyncData(next);
    if (next.isGranted) {
      unawaited(ref.read(pushCoordinatorProvider).sync());
    }
  }

  Future<void> openSettings() async {
    await ref.read(deviceNotificationPermissionProvider).openSettings();
    state = AsyncData(
      await ref.read(deviceNotificationPermissionProvider).status(),
    );
  }
}

final notificationPermissionControllerProvider =
    AsyncNotifierProvider<
      NotificationPermissionController,
      NotificationPermissionState
    >(NotificationPermissionController.new);
