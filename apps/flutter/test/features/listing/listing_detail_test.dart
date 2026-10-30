import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/features/listing/domain/listing_detail.dart';
import 'package:mon_appart/features/listing/domain/listing_page.dart';
import 'package:mon_appart/features/listing/domain/listing_share_text.dart';

import '../../helpers/listing_fixtures.dart';

void main() {
  test('mappe une fiche Nest publique', () {
    final listing = ListingDetail.fromJson(listingDetailJson());
    expect(listing.listingId, '11111111-1111-1111-1111-111111111111');
    expect(listing.propertyId, '22222222-2222-2222-2222-222222222222');
    expect(listing.priceLabel, contains('F CFA'));
    expect(listing.priceLabel, contains('/ mois'));
    expect(listing.location.label, contains('Riviera'));
    expect(listing.location.isApproximate, isTrue);
    expect(listing.location.hasPublicMapPoint, isTrue);
    expect(listing.location.hasPublicAddress, isFalse);
    expect(listing.bedrooms, 2);
    expect(listing.amenities.single.name, 'Parking');
  });

  test('n\'invente pas de marqueur si precision=NONE ou coords absentes', () {
    expect(
      ListingDetail.fromJson(listingDetailJson(precision: 'NONE'))
          .location
          .hasPublicMapPoint,
      isFalse,
    );
    expect(
      ListingDetail.fromJson(
        listingDetailJson(latitude: null, longitude: null, precision: 'EXACT'),
      ).location.hasPublicMapPoint,
      isFalse,
    );
  });

  test('n\'invente pas un prix ni des chambres absents', () {
    final json = listingDetailJson(price: null, description: null);
    (json['property'] as Map)['bedrooms'] = null;
    (json['property'] as Map)['bathrooms'] = null;
    final listing = ListingDetail.fromJson(json);
    expect(listing.price, isNull);
    expect(listing.priceLabel, 'Prix sur demande');
    expect(listing.bedrooms, isNull);
    expect(listing.description, isNull);
  });

  test('le texte de partage n\'invente pas d\'URL', () {
    final listing = ListingDetail.fromJson(listingDetailJson());
    final text = ListingShareText.of(listing);
    expect(text, contains('Appartement 2 chambres à Cocody'));
    expect(text, contains('À louer'));
    expect(text, isNot(contains('http')));
  });

  test('le texte de partage ajoute l\'URL publique seulement si fournie', () {
    final listing = ListingDetail.fromJson(listingDetailJson());
    final text = ListingShareText.of(
      listing,
      publicUrl:
          'https://www.example.test/biens/11111111-1111-1111-1111-111111111111',
    );
    expect(text, contains('https://www.example.test/biens/'));
  });

  test('la galerie retombe sur la couverture si les médias sont vides', () {
    final listing = ListingDetail.fromJson(listingDetailJson());
    final page = ListingPage(listing: listing);
    expect(page.gallery, hasLength(1));
    expect(page.gallery.single.previewUrl, listing.coverUrl);
  });
}
