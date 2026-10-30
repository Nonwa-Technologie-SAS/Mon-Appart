/// États d'autorisation de notification, alignés sur Android 13+ / iOS.
enum NotificationPermissionState {
  unknown,
  granted,
  denied,
  permanentlyDenied,
  unavailable,
}

extension NotificationPermissionStateX on NotificationPermissionState {
  bool get isGranted => this == NotificationPermissionState.granted;

  bool get canRequest =>
      this == NotificationPermissionState.unknown ||
      this == NotificationPermissionState.denied;
}

/// Passerelle OS. Les tests injectent une doublure.
abstract class DeviceNotificationPermission {
  Future<NotificationPermissionState> status();

  Future<NotificationPermissionState> request();

  Future<bool> openSettings();
}

class UnavailableNotificationPermission
    implements DeviceNotificationPermission {
  const UnavailableNotificationPermission();

  @override
  Future<NotificationPermissionState> status() async =>
      NotificationPermissionState.unavailable;

  @override
  Future<NotificationPermissionState> request() async =>
      NotificationPermissionState.unavailable;

  @override
  Future<bool> openSettings() async => false;
}
