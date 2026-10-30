import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/search/geo_search.dart';
import 'package:mon_appart/core/search/map_markers.dart';
import 'package:mon_appart/core/listing/listing_summary.dart';

import '../../helpers/listing_fixtures.dart';

void main() {
  test('borne le rayon sur le contrat Nest', () {
    expect(GeoSearch.clampRadius(null), isNull);
    expect(GeoSearch.clampRadius(0), isNull);
    expect(GeoSearch.clampRadius(-1), isNull);
    expect(GeoSearch.clampRadius(80), GeoSearch.maxRadiusKm);
    expect(GeoSearch.clampRadius(5), 5);
  });

  test('un viewport devient un rayon centre+km, pas une bbox', () {
    final radius = GeoSearch.radiusFromBounds(
      north: 5.4,
      south: 5.3,
      east: -3.9,
      west: -4.0,
      centerLatitude: 5.35,
      centerLongitude: -3.95,
    );
    expect(radius, greaterThan(0));
    expect(radius, lessThanOrEqualTo(GeoSearch.maxRadiusKm));
  });

  test('la distance Nest n\'est jamais présentée comme un trajet', () {
    expect(GeoSearch.formatNestDistance(1.2), contains('vol d\'oiseau'));
    expect(GeoSearch.formatNestDistance(null), isNull);
  });

  test('ignore les biens sans coordonnées publiques', () {
    final hidden = ListingSummary.fromJson(listingJson());
    final visible = ListingSummary.fromJson(
      listingJson(
        id: '33333333-3333-3333-3333-333333333333',
        latitude: 5.36,
        longitude: -3.96,
        precision: 'APPROXIMATE',
      ),
    );
    final markers = MapMarkers.fromListings([hidden, visible]);
    expect(markers, hasLength(1));
    expect(markers.single.listing.listingId, visible.listingId);
    final clustered = MapMarkers.cluster(markers, zoom: 14);
    expect(clustered, hasLength(1));
    expect(clustered.single.isSingle, isTrue);
  });

  test('le cluster compte les marqueurs réels', () {
    final markers = [
      for (var i = 0; i < 12; i++)
        ListingMapMarker(
          listing: ListingSummary.fromJson(
            listingJson(
              id: '33333333-3333-3333-3333-3333333333${i.toString().padLeft(2, '0')}',
              latitude: 5.36,
              longitude: -3.96,
              precision: 'APPROXIMATE',
            ),
          ),
          latitude: 5.36,
          longitude: -3.96,
        ),
    ];
    final clustered = MapMarkers.cluster(markers, zoom: 8);
    expect(clustered.single.count, 12);
  });
}
