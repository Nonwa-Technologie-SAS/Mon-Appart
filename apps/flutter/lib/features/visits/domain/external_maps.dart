import '../../../core/search/geo_search.dart';

/// Liens de navigation externe. Aucune durée ni trafic n'est calculé ici.
abstract final class ExternalMaps {
  static const maxWaypoints = 8;

  static bool isAllowed(Uri uri) {
    if (uri.scheme == 'geo') {
      return uri.path.isNotEmpty || uri.query.isNotEmpty;
    }
    if (uri.scheme != 'https') {
      return false;
    }
    if (uri.host == 'www.google.com') {
      return uri.path.startsWith('/maps/');
    }
    if (uri.host == 'maps.apple.com') {
      return true;
    }
    return false;
  }

  /// Destination unique. Coordonnées seulement, jamais d'adresse privée.
  static Uri? destination({
    required double latitude,
    required double longitude,
  }) {
    if (!GeoSearch.isPair(latitude, longitude)) {
      return null;
    }
    return Uri.https('www.google.com', '/maps/dir/', {
      'api': '1',
      'destination': '${_coord(latitude)},${_coord(longitude)}',
      'travelmode': 'driving',
    });
  }

  /// Tournée Google Maps. Origine = première étape (pas la position appareil).
  static Uri? tour(List<(double, double)> points) {
    if (points.isEmpty) {
      return null;
    }
    if (points.length == 1) {
      return destination(latitude: points.first.$1, longitude: points.first.$2);
    }
    final valid = [
      for (final point in points)
        if (GeoSearch.isPair(point.$1, point.$2)) point,
    ];
    if (valid.isEmpty) {
      return null;
    }
    if (valid.length == 1) {
      return destination(latitude: valid.first.$1, longitude: valid.first.$2);
    }
    final origin = valid.first;
    final dest = valid.last;
    final middle = valid.sublist(1, valid.length - 1).take(maxWaypoints);
    final params = <String, String>{
      'api': '1',
      'origin': '${_coord(origin.$1)},${_coord(origin.$2)}',
      'destination': '${_coord(dest.$1)},${_coord(dest.$2)}',
      'travelmode': 'driving',
    };
    if (middle.isNotEmpty) {
      params['waypoints'] = [
        for (final point in middle) '${_coord(point.$1)},${_coord(point.$2)}',
      ].join('|');
    }
    return Uri.https('www.google.com', '/maps/dir/', params);
  }

  static String _coord(double value) => value.toStringAsFixed(5);
}
