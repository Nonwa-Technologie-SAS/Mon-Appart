import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/errors/app_failure.dart';
import 'device_location.dart';

/// Position unique, précision basse (rayon km). Pas de stream ni d'arrière-plan.
class GeolocatorLocation implements DeviceLocation {
  const GeolocatorLocation();

  bool get _supported => !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  @override
  Future<LocationPermissionUi> status() async {
    if (!_supported) {
      return LocationPermissionUi.unavailable;
    }
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      return LocationPermissionUi.serviceDisabled;
    }
    return _map(await Geolocator.checkPermission());
  }

  @override
  Future<LocationPermissionUi> request() async {
    if (!_supported) {
      return LocationPermissionUi.unavailable;
    }
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      return LocationPermissionUi.serviceDisabled;
    }
    return _map(await Geolocator.requestPermission());
  }

  @override
  Future<DevicePosition> current() async {
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.low,
          timeLimit: Duration(seconds: 15),
        ),
      );
      return DevicePosition(
        latitude: position.latitude,
        longitude: position.longitude,
      );
    } on LocationFailure {
      rethrow;
    } catch (_) {
      throw const LocationFailure();
    }
  }

  @override
  Future<bool> openSettings() async {
    if (!_supported) {
      return false;
    }
    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.deniedForever) {
      return Geolocator.openAppSettings();
    }
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      return Geolocator.openLocationSettings();
    }
    return Geolocator.openAppSettings();
  }

  LocationPermissionUi _map(LocationPermission permission) {
    return switch (permission) {
      LocationPermission.always ||
      LocationPermission.whileInUse => LocationPermissionUi.granted,
      LocationPermission.deniedForever =>
        LocationPermissionUi.permanentlyDenied,
      LocationPermission.denied => LocationPermissionUi.denied,
      LocationPermission.unableToDetermine => LocationPermissionUi.unknown,
    };
  }
}
