import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/search/explore_query.dart';

void main() {
  test('sérialise les filtres Nest vers l\'URL Explorer', () {
    const query = ExploreQuery(
      q: 'villa cocody',
      listingType: 'RENT',
      commune: 'COCODY',
      minPrice: 100000,
      maxPrice: 300000,
    );
    final location = Uri.parse(query.toLocation());
    expect(location.path, '/explore');
    expect(location.queryParameters['q'], 'villa cocody');
    expect(location.queryParameters['listingType'], 'RENT');
    expect(location.queryParameters['commune'], 'COCODY');
    expect(location.queryParameters['minPrice'], '100000');
    expect(location.queryParameters['maxPrice'], '300000');
  });

  test('round-trip depuis une URI', () {
    final parsed = ExploreQuery.fromUri(
      Uri.parse(
        '/explore?q=maison&propertyType=LAND&city=ABIDJAN&bedrooms=2&amenities=PARKING,SECURITY',
      ),
    );
    expect(parsed.q, 'maison');
    expect(parsed.propertyType, 'LAND');
    expect(parsed.city, 'ABIDJAN');
    expect(parsed.bedrooms, 2);
    expect(parsed.amenityCodes, ['PARKING', 'SECURITY']);
  });

  test('n\'impose pas de tri quand une requête texte est présente', () {
    const query = ExploreQuery(q: 'cocody', limit: 20);
    expect(query.toApiQuery().containsKey('sort'), isFalse);
    expect(query.toApiQuery()['q'], 'cocody');
  });

  test('valide le budget XOF', () {
    expect(
      const ExploreQuery(minPrice: 400000, maxPrice: 200000).budgetError,
      isNotNull,
    );
    expect(
      const ExploreQuery(minPrice: 100000, maxPrice: 200000).budgetError,
      isNull,
    );
    expect(const ExploreQuery(minPrice: -1).budgetError, isNotNull);
  });

  test('le curseur n\'appartient pas aux critères URL', () {
    const query = ExploreQuery(listingType: 'RENT');
    expect(query.toLocation(), isNot(contains('cursor')));
    expect(query.toApiQuery(cursor: 'abc')['cursor'], 'abc');
    expect(query.toApiQuery()['cursor'], isNull);
  });

  test('copyWith peut effacer un champ', () {
    const query = ExploreQuery(q: 'cocody', listingType: 'RENT');
    final cleared = query.copyWith(q: null);
    expect(cleared.q, isNull);
    expect(cleared.listingType, 'RENT');
  });

  test('toggleCsv combine les codes pour l\'API', () {
    const query = ExploreQuery();
    final next = query
        .toggleCsv('listingType', 'RENT')
        .toggleCsv('listingType', 'SALE');
    expect(next.listingType, 'RENT,SALE');
    expect(next.activeFilterCount, 1);
  });

  test('submit n\'est envoyé que pour une recherche validée', () {
    const query = ExploreQuery(q: 'cocody');
    expect(query.toApiQuery()['submit'], isNull);
    expect(query.toApiQuery(submit: true)['submit'], 'true');
  });

  test('toSavedSearchParams omet sort et conserve le budget XOF', () {
    const query = ExploreQuery(
      listingType: 'RENT',
      commune: 'COCODY',
      minPrice: 150000,
      maxPrice: 300000,
      sort: 'NEWEST',
      limit: 20,
    );
    final params = query.toSavedSearchParams();
    expect(params['minPrice'], '150000');
    expect(params['maxPrice'], '300000');
    expect(params.containsKey('sort'), isFalse);
    expect(params.containsKey('limit'), isFalse);
    expect(query.hasAlertableCriteria, isTrue);
    expect(const ExploreQuery(q: 'cocody').hasAlertableCriteria, isFalse);
  });

  test('envoie lat/lng/radius à Nest et conserve view hors API', () {
    const query = ExploreQuery(
      lat: 5.35912,
      lng: -3.95844,
      radius: 5,
      view: 'map',
    );
    final api = query.toApiQuery();
    expect(api['lat'], '5.3591');
    expect(api['lng'], '-3.9584');
    expect(api['radius'], '5.0');
    expect(api.containsKey('view'), isFalse);
    expect(query.toQueryParameters()['view'], 'map');
    expect(query.toSavedSearchParams().containsKey('view'), isFalse);
    expect(query.hasGeo, isTrue);
    expect(query.hasUserIntent, isTrue);
  });

  test('n\'envoie pas un rayon sans couple lat/lng', () {
    const query = ExploreQuery(radius: 10);
    expect(query.toApiQuery().containsKey('lat'), isFalse);
    expect(query.toApiQuery().containsKey('radius'), isFalse);
  });
}
