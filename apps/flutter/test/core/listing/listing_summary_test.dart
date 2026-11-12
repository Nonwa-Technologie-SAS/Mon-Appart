import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/listing/listing_summary.dart';

import '../../helpers/listing_fixtures.dart';

void main() {
  test('mappe un SearchResultItem Nest', () {
    final listing = ListingSummary.fromJson(listingJson());
    expect(listing.title, contains('Cocody'));
    expect(listing.listingTypeLabel, 'À louer');
    expect(listing.locationLabel, 'Riviera · Cocody · Abidjan');
    expect(listing.specsLabel, '2 ch. · 1 sdb · 75 m²');
    expect(listing.priceLabel, contains('/ mois'));
    expect(listing.mainImageUrl, isNull);
  });

  test('gère l\'absence de prix, surface et pièces', () {
    final listing = ListingSummary.fromJson(
      listingJson(price: null, bedrooms: null, bathrooms: null, surface: null),
    );
    expect(listing.priceLabel, 'Prix sur demande');
    expect(listing.specsLabel, isNull);
  });

  test('ignore un élément mal formé', () {
    expect(ListingSummary.tryFromJson({'title': 'incomplet'}), isNull);
  });

  test('n\'expose un point carte que si Nest fournit des coords publiques', () {
    final hidden = ListingSummary.fromJson(listingJson());
    expect(hidden.hasPublicMapPoint, isFalse);
    final visible = ListingSummary.fromJson(
      listingJson(
        latitude: 5.36,
        longitude: -3.96,
        precision: 'APPROXIMATE',
        distance: const {'value': 1.2, 'unit': 'km'},
      ),
    );
    expect(visible.hasPublicMapPoint, isTrue);
    expect(visible.distanceKm, 1.2);
    expect(visible.precision, 'APPROXIMATE');
  });
}
