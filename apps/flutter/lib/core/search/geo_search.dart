import 'dart:math' as math;

/// Contrats geo Nest `GET /api/v1/search` : `lat`, `lng`, `radius` (km).
///
/// Pas de bbox / viewport / cluster côté API. Le rayon maximal est
/// `SEARCH_MAX_RADIUS_KM` (défaut 50). Défaut Nest : 10 km.
abstract final class GeoSearch {
  static const defaultRadiusKm = 10.0;
  static const maxRadiusKm = 50.0;
  static const minRadiusKm = 0.1;
  static const coordDecimals = 4;

  static const radiusOptionsKm = <double>[1, 3, 5, 10, 20];

  static const coteIvoire = (
    minLatitude: 4.2,
    maxLatitude: 10.8,
    minLongitude: -8.7,
    maxLongitude: -2.4,
  );

  static const abidjan = (latitude: 5.36, longitude: -4.01);

  static const defaultZoom = 11.5;
  static const minZoom = 6.5;
  static const maxZoom = 16.0;

  static bool isValidLatitude(double? value) {
    return value != null && value >= -90 && value <= 90;
  }

  static bool isValidLongitude(double? value) {
    return value != null && value >= -180 && value <= 180;
  }

  static bool isPair(double? latitude, double? longitude) {
    return isValidLatitude(latitude) && isValidLongitude(longitude);
  }

  static double? clampRadius(double? radiusKm) {
    if (radiusKm == null || radiusKm.isNaN || radiusKm <= 0) {
      return null;
    }
    if (radiusKm < minRadiusKm) {
      return minRadiusKm;
    }
    if (radiusKm > maxRadiusKm) {
      return maxRadiusKm;
    }
    return double.parse(radiusKm.toStringAsFixed(3));
  }

  static double roundCoord(double value) {
    final factor = math.pow(10, coordDecimals).toDouble();
    return (value * factor).round() / factor;
  }

  static double? parseCoord(String? raw, {required bool latitude}) {
    if (raw == null || raw.trim().isEmpty) {
      return null;
    }
    final value = double.tryParse(raw.trim());
    if (latitude) {
      return isValidLatitude(value) ? roundCoord(value!) : null;
    }
    return isValidLongitude(value) ? roundCoord(value!) : null;
  }

  static double? parseRadius(String? raw) {
    if (raw == null || raw.trim().isEmpty) {
      return null;
    }
    return clampRadius(double.tryParse(raw.trim()));
  }

  static String formatRadiusKm(double radiusKm) {
    if (radiusKm >= 10) {
      return '${radiusKm.round()} km';
    }
    final rounded = radiusKm == radiusKm.roundToDouble()
        ? '${radiusKm.round()}'
        : radiusKm.toStringAsFixed(1).replaceFirst(RegExp(r'\.0$'), '');
    return '$rounded km';
  }

  /// Distance Nest `{ value, unit: km }` — jamais une distance routière.
  static String? formatNestDistance(num? valueKm) {
    if (valueKm == null) {
      return null;
    }
    final km = valueKm.toDouble();
    if (km < 0) {
      return null;
    }
    if (km < 1) {
      final meters = (km * 1000).round();
      return '$meters m à vol d\'oiseau';
    }
    return '${formatRadiusKm(km)} à vol d\'oiseau';
  }

  static double haversineKm(
    double latitudeA,
    double longitudeA,
    double latitudeB,
    double longitudeB,
  ) {
    const earthKm = 6371.0;
    final dLat = _rad(latitudeB - latitudeA);
    final dLng = _rad(longitudeB - longitudeA);
    final a =
        math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_rad(latitudeA)) *
            math.cos(_rad(latitudeB)) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    return 2 * earthKm * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }

  /// Repli viewport → centre + rayon : Nest n'a pas de bbox.
  static double radiusFromBounds({
    required double north,
    required double south,
    required double east,
    required double west,
    required double centerLatitude,
    required double centerLongitude,
  }) {
    final cornerKm = haversineKm(centerLatitude, centerLongitude, north, east);
    return clampRadius(cornerKm) ?? defaultRadiusKm;
  }

  static bool inCoteIvoire(double latitude, double longitude) {
    return latitude >= coteIvoire.minLatitude &&
        latitude <= coteIvoire.maxLatitude &&
        longitude >= coteIvoire.minLongitude &&
        longitude <= coteIvoire.maxLongitude;
  }

  static double _rad(double degrees) => degrees * math.pi / 180;
}
