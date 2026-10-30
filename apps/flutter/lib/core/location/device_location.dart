/// Position ponctuelle. Ne jamais journaliser ces champs.
class DevicePosition {
  const DevicePosition({required this.latitude, required this.longitude});

  final double latitude;
  final double longitude;
}

enum LocationPermissionUi {
  unknown,
  granted,
  denied,
  permanentlyDenied,
  serviceDisabled,
  unavailable,
}

abstract class DeviceLocation {
  Future<LocationPermissionUi> status();

  Future<LocationPermissionUi> request();

  Future<DevicePosition> current();

  Future<bool> openSettings();
}

class UnavailableDeviceLocation implements DeviceLocation {
  const UnavailableDeviceLocation();

  @override
  Future<LocationPermissionUi> status() async =>
      LocationPermissionUi.unavailable;

  @override
  Future<LocationPermissionUi> request() async =>
      LocationPermissionUi.unavailable;

  @override
  Future<DevicePosition> current() async {
    throw const FormatException('Géolocalisation indisponible.');
  }

  @override
  Future<bool> openSettings() async => false;
}

class FakeDeviceLocation implements DeviceLocation {
  FakeDeviceLocation({
    this.permission = LocationPermissionUi.granted,
    this.position = const DevicePosition(latitude: 5.359, longitude: -3.958),
    this.settingsOpened = false,
  });

  LocationPermissionUi permission;
  DevicePosition? position;
  bool settingsOpened;

  @override
  Future<LocationPermissionUi> status() async => permission;

  @override
  Future<LocationPermissionUi> request() async => permission;

  @override
  Future<DevicePosition> current() async {
    final next = position;
    if (next == null) {
      throw const FormatException('Position absente.');
    }
    return next;
  }

  @override
  Future<bool> openSettings() async {
    settingsOpened = true;
    return true;
  }
}
