import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/listing/search_page.dart';

import '../../helpers/listing_fixtures.dart';

void main() {
  test('affiche le total exact fourni par Nest', () {
    final page = SearchPage.fromJson(searchResponseJson());
    expect(page.totalLabel, '1 annonce');
    expect(page.hasMore, isFalse);
  });

  test('n\'invente pas un total si strategy=not_available', () {
    final page = SearchPage.fromJson({
      'items': [listingJson()],
      'pagination': {'nextCursor': 'x', 'hasMore': true, 'limit': 20},
      'total': {'value': 20, 'strategy': 'not_available'},
    });
    expect(page.totalLabel, isNull);
    expect(page.hasMore, isTrue);
    expect(page.nextCursor, 'x');
  });

  test('estime le total sans le présenter comme un compte exact', () {
    final page = SearchPage.fromJson({
      'items': [listingJson()],
      'pagination': {'nextCursor': null, 'hasMore': false, 'limit': 20},
      'total': {'value': 1000, 'strategy': 'estimated'},
    });
    expect(page.totalLabel, 'Au moins 1000 annonces');
  });
}
