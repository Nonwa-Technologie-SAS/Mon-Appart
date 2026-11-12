import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/features/listing/domain/listing_trust.dart';

import '../../helpers/listing_fixtures.dart';

void main() {
  test('sépare les badges d\'annonce et d\'annonceur', () {
    final trust = ListingTrust.fromJson(
      listingBadgesJson(
          badges: [
            {
              'code': 'LISTING_CHECKED',
              'label': 'Annonce contrôlée',
              'verifiedAt': '2026-10-01T00:00:00.000Z',
            },
          ],
        )
        ..['publisherBadges'] = [
          {
            'code': 'IDENTITY',
            'label': 'Identité confirmée',
            'verifiedAt': '2026-09-01T00:00:00.000Z',
          },
        ],
    );
    expect(trust.listingBadges.single.code, 'LISTING_CHECKED');
    expect(trust.publisherBadges.single.code, 'IDENTITY');
    expect(trust.listingBadges.single.label, isNot('Vérifié'));
    expect(trust.disclaimer, contains('examen des pièces'));
  });

  test('n\'invente pas un badge Vérifié si Nest n\'en fournit pas', () {
    final trust = ListingTrust.fromJson(listingBadgesJson());
    expect(trust.hasContent, isFalse);
    expect(trust.listingBadges, isEmpty);
    expect(trust.publisherBadges, isEmpty);
  });
}
