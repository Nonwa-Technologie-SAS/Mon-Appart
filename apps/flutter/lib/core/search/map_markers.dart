import '../listing/listing_summary.dart';

class ListingMapMarker {
  const ListingMapMarker({
    required this.listing,
    required this.latitude,
    required this.longitude,
  });

  final ListingSummary listing;
  final double latitude;
  final double longitude;
}

class MapMarkerCluster {
  const MapMarkerCluster({
    required this.latitude,
    required this.longitude,
    required this.markers,
  });

  final double latitude;
  final double longitude;
  final List<ListingMapMarker> markers;

  bool get isSingle => markers.length == 1;

  int get count => markers.length;

  ListingMapMarker get first => markers.first;
}

abstract final class MapMarkers {
  /// Uniquement les points publics Nest (`precision` ≠ `NONE`, coords présentes).
  static List<ListingMapMarker> fromListings(
    Iterable<ListingSummary> listings,
  ) {
    final markers = <ListingMapMarker>[];
    for (final listing in listings) {
      if (!listing.hasPublicMapPoint) {
        continue;
      }
      markers.add(
        ListingMapMarker(
          listing: listing,
          latitude: listing.latitude!,
          longitude: listing.longitude!,
        ),
      );
    }
    return markers;
  }

  /// Clustering client. Le compteur est le nombre réel de marqueurs du lot.
  static List<MapMarkerCluster> cluster(
    List<ListingMapMarker> markers, {
    required double zoom,
  }) {
    if (markers.isEmpty) {
      return const [];
    }
    if (zoom >= 13 || markers.length <= 8) {
      return [
        for (final marker in markers)
          MapMarkerCluster(
            latitude: marker.latitude,
            longitude: marker.longitude,
            markers: [marker],
          ),
      ];
    }
    final cell = zoom >= 11
        ? 0.02
        : zoom >= 9
        ? 0.05
        : 0.1;
    final buckets = <String, List<ListingMapMarker>>{};
    for (final marker in markers) {
      final key =
          '${(marker.latitude / cell).floor()}:${(marker.longitude / cell).floor()}';
      (buckets[key] ??= []).add(marker);
    }
    return [
      for (final group in buckets.values)
        MapMarkerCluster(
          latitude: _average(group, (item) => item.latitude),
          longitude: _average(group, (item) => item.longitude),
          markers: group,
        ),
    ];
  }

  static double _average(
    List<ListingMapMarker> markers,
    double Function(ListingMapMarker marker) read,
  ) {
    var sum = 0.0;
    for (final marker in markers) {
      sum += read(marker);
    }
    return sum / markers.length;
  }
}
