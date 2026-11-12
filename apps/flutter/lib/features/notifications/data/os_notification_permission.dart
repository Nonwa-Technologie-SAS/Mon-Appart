import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';

import '../domain/device_notification_permission.dart';

/// Implémentation Android / iOS. Hors ces plateformes : indisponible.
class OsNotificationPermission implements DeviceNotificationPermission {
  const OsNotificationPermission();

  bool get _supported => !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  @override
  Future<NotificationPermissionState> status() async {
    if (!_supported) {
      return NotificationPermissionState.unavailable;
    }
    return _map(await Permission.notification.status);
  }

  @override
  Future<NotificationPermissionState> request() async {
    if (!_supported) {
      return NotificationPermissionState.unavailable;
    }
    return _map(await Permission.notification.request());
  }

  @override
  Future<bool> openSettings() async {
    if (!_supported) {
      return false;
    }
    return openAppSettings();
  }

  NotificationPermissionState _map(PermissionStatus status) {
    if (status.isGranted || status.isLimited || status.isProvisional) {
      return NotificationPermissionState.granted;
    }
    if (status.isPermanentlyDenied) {
      return NotificationPermissionState.permanentlyDenied;
    }
    if (status.isDenied) {
      return NotificationPermissionState.denied;
    }
    return NotificationPermissionState.unknown;
  }
}
