import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/features/listing/domain/listing_media.dart';

import '../../helpers/listing_fixtures.dart';

void main() {
  test('respecte l\'ordre et la variante GALLERY', () {
    final page = ListingMediaPage.fromJson(listingMediaJson());
    expect(page.images, hasLength(1));
    expect(page.images.single.isPrimary, isTrue);
    expect(page.images.single.previewUrl, 'https://cdn.example/photo.jpg');
    expect(page.images.single.viewerUrl, 'https://cdn.example/photo-lg.jpg');
  });

  test('ignore une vidéo sans lecteur dédié dans la galerie photo', () {
    final page = ListingMediaPage.fromJson({
      'items': [
        {
          'id': '55555555-5555-4555-8555-555555555555',
          'type': 'VIDEO',
          'sortOrder': 0,
          'isPrimary': false,
          'url': 'https://cdn.example/video.mp4',
          'variants': <Object?>[],
        },
      ],
    });
    expect(page.images, isEmpty);
  });
}
