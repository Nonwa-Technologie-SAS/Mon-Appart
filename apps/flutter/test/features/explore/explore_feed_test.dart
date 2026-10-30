import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/listing/search_page.dart';
import 'package:mon_appart/core/search/explore_query.dart';
import 'package:mon_appart/features/explore/domain/explore_feed.dart';

import '../../helpers/listing_fixtures.dart';

void main() {
  test('fusionne les pages sans doublon d\'identifiant', () {
    final first = ExploreFeed.fromPage(
      const ExploreQuery(),
      SearchPage.fromJson(
        searchResponseJson(
          items: [
            listingJson(id: 'a'),
            listingJson(id: 'b'),
          ],
        ),
      ),
    );
    final merged = first.mergePage(
      SearchPage.fromJson(
        searchResponseJson(
          items: [
            listingJson(id: 'b'),
            listingJson(id: 'c', title: 'Nouveau'),
          ],
        ),
      ),
    );
    expect(merged.items.map((item) => item.listingId), ['a', 'b', 'c']);
  });

  test('un changement de critères n\'est pas porté par le curseur', () {
    const a = ExploreQuery(listingType: 'RENT', sort: 'NEWEST');
    const b = ExploreQuery(listingType: 'RENT', sort: 'PRICE_ASC');
    expect(a == b, isFalse);
  });
}
