import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/search/search_sort.dart';

void main() {
  test('le tri par défaut suit le contrat Nest', () {
    expect(SearchSorts.resolve(null, hasText: true).code, 'RELEVANCE');
    expect(SearchSorts.resolve(null, hasText: false).code, 'NEWEST');
    expect(SearchSorts.resolve('PRICE_DESC', hasText: true).code, 'PRICE_DESC');
  });

  test('DISTANCE n\'est proposé qu\'avec lat/lng', () {
    expect(
      SearchSorts.all.map((item) => item.code),
      isNot(contains('DISTANCE')),
    );
    expect(SearchSorts.resolve('DISTANCE', hasText: false).code, 'NEWEST');
    expect(
      SearchSorts.resolve('DISTANCE', hasText: false, hasGeo: true).code,
      'DISTANCE',
    );
  });
}
