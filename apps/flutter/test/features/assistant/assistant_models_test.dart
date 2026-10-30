import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/features/assistant/data/assistant_session.dart';
import 'package:mon_appart/features/assistant/domain/assistant_models.dart';

import '../../helpers/listing_fixtures.dart';

void main() {
  test('parse un tour Nest et ignore les cartes invalides', () {
    final json = assistantTurnJson(
      listings: [
        {
          'listingId': '11111111-1111-1111-1111-111111111111',
          'propertyId': '22222222-2222-2222-2222-222222222222',
          'title': 'Maison 3 chambres à Cocody',
          'listingType': 'RENT',
          'propertyType': {'code': 'HOUSE', 'name': 'Maison'},
          'price': {'amount': 250000, 'currency': 'XOF', 'period': 'MONTH'},
          'locationLabel': 'Cocody',
          'matchReasons': ['Dans votre budget maximum'],
        },
        {'title': 'carte incomplète'},
      ],
    );
    final turn = AssistantTurn.fromJson(json);
    expect(turn.mode, AssistantMode.results);
    expect(turn.listings, hasLength(1));
    expect(turn.listings.single.asSummary.cityName, 'Cocody');
    expect(turn.listings.single.matchReasons, ['Dans votre budget maximum']);
    expect(turn.criteria.chips, containsAll(['À louer', 'Maison', 'Cocody']));
    expect(turn.criteria.chips.any((chip) => chip.contains('250')), isTrue);
    expect(turn.exploreQuery.listingType, 'RENT');
    expect(turn.exploreQuery.maxPrice, 250000);
    expect(turn.exploreQuery.commune, 'Cocody');
  });

  test('un mode inconnu ou un JSON incomplet ne fabrique pas de biens', () {
    expect(
      () => AssistantTurn.fromJson({'mode': 'results'}),
      throwsFormatException,
    );
    final turn = AssistantTurn.fromJson({
      'mode': 'mystery',
      'message': 'Critères conservés.',
      'conversationId': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'listings': 'oops',
    });
    expect(turn.mode, AssistantMode.error);
    expect(turn.listings, isEmpty);
  });

  test(
    'exploreQuery ignore submit et amenitiesMode absents de ExploreQuery',
    () {
      final query = exploreQueryFromSearchParams({
        'listingType': 'SALE',
        'submit': 'false',
        'amenitiesMode': 'AND',
        'maxPrice': '10000000',
      });
      expect(query.listingType, 'SALE');
      expect(query.maxPrice, 10000000);
      expect(query.toApiQuery().containsKey('submit'), isFalse);
    },
  );

  test('les suggestions Nest sont classées sans parseur local', () {
    expect(
      suggestionKind('Lancer la recherche'),
      AssistantSuggestionKind.forceSearch,
    );
    expect(suggestionKind('Sans budget'), AssistantSuggestionKind.forceSearch);
    expect(suggestionKind('Tout Abidjan'), AssistantSuggestionKind.forceSearch);
    expect(
      suggestionKind('Ouvrir la recherche classique'),
      AssistantSuggestionKind.classic,
    );
    expect(
      suggestionKind('3 chambres minimum'),
      AssistantSuggestionKind.message,
    );
  });

  test('périodicité du budget affichée, jamais convertie', () {
    const monthly = AssistantCriteria(priceMax: 200000, pricePeriod: 'MONTH');
    const sale = AssistantCriteria(priceMax: 200000, pricePeriod: 'TOTAL');
    expect(monthly.chips.single, contains('/ mois'));
    expect(sale.chips.single, contains('prix total'));
    expect(monthly.chips.single, isNot(equals(sale.chips.single)));
  });

  test('session anonyme UUID v4', () {
    final id = createUuidV4();
    expect(
      id,
      matches(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ),
      ),
    );
  });
}
