import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/listing/money_format.dart';
import 'package:mon_appart/features/account/domain/housing_preferences.dart';
import 'package:mon_appart/features/compare/domain/compare_models.dart';
import 'package:mon_appart/features/compare/domain/compare_rules.dart';
import 'package:mon_appart/features/compare/domain/shortlist_entry.dart';
import 'package:mon_appart/features/listing/domain/listing_detail.dart';
import 'package:mon_appart/features/listing/domain/listing_trust.dart';

import '../../helpers/listing_fixtures.dart';

const _cheaperId = '33333333-3333-3333-3333-333333333333';
const _saleId = '55555555-5555-5555-5555-555555555555';
const _landId = '77777777-7777-7777-7777-777777777777';

CompareItem _loaded(
  Map<String, Object?> json, [
  ListingTrust trust = const ListingTrust(),
]) {
  return CompareItem.loaded(ListingDetail.fromJson(json), trust);
}

void main() {
  test('n\'égale pas un loyer mensuel et un prix de vente', () {
    final rent = ListingDetail.fromJson(listingDetailJson());
    final sale = ListingDetail.fromJson(
      listingDetailJson(
        id: _saleId,
        listingType: 'SALE',
        price: const {'amount': '250000', 'currency': 'XOF', 'period': 'TOTAL'},
      ),
    );
    expect(CompareRules.pricesComparable(rent.price, sale.price), isFalse);
  });

  test('compare uniquement la même devise et la même périodicité', () {
    final month = ListingDetail.fromJson(listingDetailJson()).price;
    final year = ListingPrice.tryParse(const {
      'amount': 250000,
      'currency': 'XOF',
      'period': 'YEAR',
    });
    final euro = ListingPrice.tryParse(const {
      'amount': 250000,
      'currency': 'EUR',
      'period': 'MONTH',
    });
    expect(CompareRules.pricesComparable(month, month), isTrue);
    expect(CompareRules.pricesComparable(month, year), isFalse);
    expect(CompareRules.pricesComparable(month, euro), isFalse);
  });

  test(
    'calcule le prix au m² seulement si montant et surface sont valides',
    () {
      final rent = ListingDetail.fromJson(listingDetailJson());
      expect(CompareRules.pricePerSquareMeter(rent.price, '75'), 3333);
      expect(CompareRules.pricePerSquareMeter(rent.price, null), isNull);
      expect(CompareRules.pricePerSquareMeter(rent.price, '0'), isNull);
      expect(CompareRules.pricePerSquareMeter(rent.price, '-10'), isNull);
      expect(
        CompareRules.pricePerSquareMeter(
          const ListingPrice(amount: 0, currency: 'XOF', period: 'TOTAL'),
          '400',
        ),
        isNull,
      );
    },
  );

  test('une surface absente n\'est pas traitée comme zéro', () {
    expect(CompareRules.parseArea(null), isNull);
    expect(CompareRules.parseArea(''), isNull);
    expect(CompareRules.parseArea('abc'), isNull);
    final land = ListingDetail.fromJson(
      listingDetailJson(
        id: _landId,
        title: 'Terrain Bingerville',
        listingType: 'SALE',
        propertyTypeCode: 'LAND',
        propertyTypeName: 'Terrain',
        surface: null,
        landSurface: null,
        bedrooms: null,
        bathrooms: null,
        amenities: const [],
        price: const {
          'amount': '15000000',
          'currency': 'XOF',
          'period': 'TOTAL',
        },
      ),
    );
    expect(CompareRules.comparableArea(land), isNull);
    expect(
      CompareRules.pricePerSquareMeter(land.price, land.landSurface),
      isNull,
    );
  });

  test('le budget distingue respect, tolérance et dépassement', () {
    final listing = ListingDetail.fromJson(listingDetailJson());
    const none = HousingPreferences();
    const monthly = HousingPreferences(
      maxBudget: 200000,
      currency: 'XOF',
      budgetPeriod: 'MONTH',
    );
    const tight = HousingPreferences(
      maxBudget: 240000,
      currency: 'XOF',
      budgetPeriod: 'MONTH',
      tolerancePct: 10,
    );
    const tolerant = HousingPreferences(
      maxBudget: 200000,
      currency: 'XOF',
      budgetPeriod: 'MONTH',
      tolerancePct: 30,
    );
    const yearly = HousingPreferences(
      maxBudget: 3000000,
      currency: 'XOF',
      budgetPeriod: 'YEAR',
    );
    expect(
      CompareRules.budgetFit(listing: listing, preferences: none),
      BudgetFit.none,
    );
    expect(
      CompareRules.budgetFit(listing: listing, preferences: monthly),
      BudgetFit.exceeds,
    );
    expect(
      CompareRules.budgetFit(listing: listing, preferences: tight),
      BudgetFit.overTarget,
    );
    expect(
      CompareRules.budgetFit(listing: listing, preferences: tolerant),
      BudgetFit.overTarget,
    );
    expect(
      CompareRules.budgetFit(listing: listing, preferences: yearly),
      BudgetFit.incomparable,
    );
    expect(
      CompareRules.budgetFit(
        listing: ListingDetail.fromJson(listingDetailJson(price: null)),
        preferences: monthly,
      ),
      BudgetFit.unknown,
    );
  });

  test(
    'les chambres minimales sont une contrainte, le parking une préférence',
    () {
      final twoRooms = _loaded(listingDetailJson());
      final threeRooms = _loaded(
        listingDetailJson(
          id: _cheaperId,
          title: 'Maison 3 chambres',
          bedrooms: 3,
          amenities: const [],
        ),
      );
      final report = CompareRules.build(
        items: [twoRooms, threeRooms],
        preferences: const HousingPreferences(
          maxBudget: 300000,
          currency: 'XOF',
          budgetPeriod: 'MONTH',
          bedrooms: 3,
          amenities: ['PARKING'],
        ),
      );
      expect(
        report.insights.any(
          (insight) =>
              insight.kind == 'constraint' &&
              insight.text.contains('ne respecte pas le minimum de 3'),
        ),
        isTrue,
      );
      expect(
        report.insights.any(
          (insight) =>
              insight.text.contains('Maison 3 chambres') &&
              insight.text.contains('ne respecte pas'),
        ),
        isFalse,
      );
      final parkingRow = report.rows.firstWhere(
        (row) => row.label == 'Parking',
      );
      expect(parkingRow.cells[0].value, 'Oui');
      expect(parkingRow.cells[1].value, 'Non renseigné');
      expect(parkingRow.cells[1].missing, isTrue);
    },
  );

  test('les explications s\'appuient sur les montants réels et ne classent pas un hors-budget', () {
    final expensive = _loaded(listingDetailJson());
    final cheaper = _loaded(
      listingDetailJson(
        id: _cheaperId,
        title: 'Studio à Marcory',
        bedrooms: 1,
        surface: '40',
        price: const {'amount': '180000', 'currency': 'XOF', 'period': 'MONTH'},
      ),
    );
    final report = CompareRules.build(
      items: [expensive, cheaper],
      preferences: const HousingPreferences(
        maxBudget: 200000,
        currency: 'XOF',
        budgetPeriod: 'MONTH',
      ),
    );
    expect(
      report.insights.any(
        (insight) =>
            insight.text.contains('Studio à Marcory est le moins cher'),
      ),
      isTrue,
    );
    expect(
      report.insights.any(
        (insight) => insight.text.contains(
          'Cela n\'en fait pas automatiquement le meilleur choix',
        ),
      ),
      isTrue,
    );
    expect(
      report.insights.any(
        (insight) =>
            insight.kind == 'budget' &&
            insight.text.contains('Dans le budget') &&
            insight.text.contains('Studio à Marcory'),
      ),
      isTrue,
    );
    expect(
      report.insights.any(
        (insight) =>
            insight.text.contains('Au-delà du budget cible') &&
            insight.text.contains('50'),
      ),
      isTrue,
    );
  });

  test(
    'une annonce indisponible est signalée sans inventer ses caractéristiques',
    () {
      final report = CompareRules.build(
        items: [
          CompareItem.unavailable(
            const ShortlistEntry(
              listingId: _saleId,
              title: 'Villa retirée',
              propertyId: '44444444-4444-4444-4444-444444444444',
            ),
          ),
          _loaded(listingDetailJson()),
        ],
      );
      expect(
        report.insights
            .singleWhere((insight) => insight.kind == 'unavailable')
            .text,
        contains('Villa retirée'),
      );
      expect(report.loadedCount, 1);
      expect(report.rows, isEmpty);
    },
  );

  test('un terrain sans surface explique l\'absence de prix au m²', () {
    final land = _loaded(
      listingDetailJson(
        id: _landId,
        title: 'Terrain Bingerville',
        listingType: 'SALE',
        propertyTypeCode: 'LAND',
        propertyTypeName: 'Terrain',
        surface: null,
        landSurface: null,
        bedrooms: null,
        bathrooms: null,
        amenities: const [],
        price: const {
          'amount': '15000000',
          'currency': 'XOF',
          'period': 'TOTAL',
        },
      ),
    );
    final other = _loaded(
      listingDetailJson(
        id: _saleId,
        title: 'Terrain Cocody',
        listingType: 'SALE',
        propertyTypeCode: 'LAND',
        propertyTypeName: 'Terrain',
        surface: null,
        landSurface: '400',
        bedrooms: null,
        bathrooms: null,
        amenities: const [],
        price: const {
          'amount': '20000000',
          'currency': 'XOF',
          'period': 'TOTAL',
        },
      ),
    );
    final report = CompareRules.build(items: [land, other]);
    expect(
      report.insights.any(
        (insight) =>
            insight.text.contains('Terrain Bingerville') &&
            insight.text.contains('prix au m² ne peut pas être calculé'),
      ),
      isTrue,
    );
    final perMeter = report.rows.firstWhere((row) => row.label == 'Prix au m²');
    expect(perMeter.cells[0].missing, isTrue);
    expect(perMeter.cells[0].value, CompareRules.missingLabel);
    expect(perMeter.cells[1].missing, isFalse);
  });

  test('les transactions mixtes n\'élisent pas un moins cher global', () {
    final report = CompareRules.build(
      items: [
        _loaded(listingDetailJson()),
        _loaded(
          listingDetailJson(
            id: _saleId,
            title: 'Appartement à vendre',
            listingType: 'SALE',
            price: const {
              'amount': '180000',
              'currency': 'XOF',
              'period': 'TOTAL',
            },
          ),
        ),
      ],
    );
    expect(report.insights.any((insight) => insight.kind == 'mix'), isTrue);
    expect(report.insights.any((insight) => insight.kind == 'price'), isFalse);
  });

  test('les champs absents restent « Information non renseignée »', () {
    final missing = listingDetailJson(price: null);
    (missing['property'] as Map)['bedrooms'] = null;
    final report = CompareRules.build(
      items: [
        _loaded(missing),
        _loaded(
          listingDetailJson(
            id: _cheaperId,
            title: 'Studio à Marcory',
            bedrooms: 1,
          ),
        ),
      ],
    );
    final priceRow = report.rows.firstWhere((row) => row.label == 'Prix');
    expect(priceRow.cells[0].missing, isTrue);
    expect(priceRow.cells[0].value, 'Prix sur demande');
    final rooms = report.rows.firstWhere((row) => row.label == 'Chambres');
    expect(rooms.cells[0].value, CompareRules.missingLabel);
    expect(
      report.questions.any((question) => question.contains('Prix sur demande')),
      isTrue,
    );
  });
}
