import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/app/config/api_endpoints.dart';
import 'package:mon_appart/core/errors/app_failure.dart';
import 'package:mon_appart/features/account/data/housing_preference_repository.dart';
import 'package:mon_appart/features/account/domain/housing_preferences.dart';
import 'package:mon_appart/features/account/domain/preference_rules.dart';

import '../../helpers/fake_api_client.dart';
import '../../helpers/listing_fixtures.dart';

void main() {
  test('fromJson lit le budget et la surface structurés Nest', () {
    final prefs = HousingPreferences.fromJson({
      'listingTypes': ['RENT'],
      'propertyTypes': ['APARTMENT'],
      'communes': ['COCODY'],
      'neighborhoods': ['RIVIERA'],
      'amenities': ['PARKING'],
      'bedrooms': 2,
      'bathrooms': 1,
      'budget': {
        'min': 150000,
        'max': 300000,
        'currency': 'XOF',
        'period': 'MONTH',
        'tolerancePct': 10,
      },
      'surface': {'min': 40, 'max': 90},
      'updatedAt': '2026-10-20T10:00:00.000Z',
    });
    expect(prefs.isEmpty, isFalse);
    expect(prefs.minBudget, 150000);
    expect(prefs.budgetPeriod, 'MONTH');
    expect(prefs.summary, contains('À louer'));
    expect(prefs.summary, contains('Cocody'));
  });

  test(
    'toPutBody envoie un remplacement plat et nulle la tolérance sans max',
    () {
      const prefs = HousingPreferences(
        listingTypes: ['RENT'],
        minBudget: 100000,
        currency: 'XOF',
        tolerancePct: 10,
      );
      final body = prefs.toPutBody();
      expect(body['listingTypes'], ['RENT']);
      expect(body['minBudget'], 100000);
      expect(body['maxBudget'], isNull);
      expect(body['budgetPeriod'], 'MONTH');
      expect(body['budgetTolerancePct'], isNull);
      expect(body.containsKey('latitude'), isFalse);
    },
  );

  test('déduit la périodicité selon le type de transaction', () {
    expect(PreferenceRules.deducePeriod(['RENT']), 'MONTH');
    expect(PreferenceRules.deducePeriod(['SALE']), 'TOTAL');
    expect(PreferenceRules.deducePeriod(['SHORT_TERM_RENT']), 'DAY');
    expect(PreferenceRules.deducePeriod(['RENT', 'SALE']), isNull);
  });

  test('refuse un budget minimum supérieur au maximum', () {
    expect(
      PreferenceRules.budgetError(min: 300000, max: 100000),
      contains('minimum ne peut pas dépasser'),
    );
    expect(PreferenceRules.budgetError(min: 100000, max: 300000), isNull);
    expect(
      PreferenceRules.budgetError(min: 0, max: 0),
      contains('au moins 1 F CFA'),
    );
  });

  test('exige une périodicité si le budget est ambigu', () {
    expect(
      PreferenceRules.periodError(
        listingTypes: ['RENT', 'SALE'],
        period: null,
        hasBudget: true,
      ),
      contains('périodicité'),
    );
    expect(
      PreferenceRules.periodError(
        listingTypes: ['RENT'],
        period: null,
        hasBudget: true,
      ),
      isNull,
    );
  });

  test('retire les quartiers d\'une commune désélectionnée', () {
    const prefs = HousingPreferences(
      communes: ['COCODY', 'MARCORY'],
      neighborhoods: ['RIVIERA', 'ZONE_4'],
    );
    final next = prefs.toggle('communes', 'COCODY');
    expect(next.communes, ['MARCORY']);
    expect(next.neighborhoods, ['ZONE_4']);
  });

  test(
    'le repository GET/PUT passe par /recommendations/preferences',
    () async {
      final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));
      final client = FakeApiClient(
        handler: (uri) async => emptyHousingPreferencesJson(),
      );
      final repo = HousingPreferenceRepository(
        client: client,
        endpoints: endpoints,
      );
      final loaded = await repo.get();
      expect(loaded.isEmpty, isTrue);
      await repo.replace(const HousingPreferences(listingTypes: ['RENT']));
      expect(client.methods, ['GET', 'PUT']);
      expect(client.uris.last.path, endsWith('/recommendations/preferences'));
      expect(client.lastBody?['listingTypes'], ['RENT']);
    },
  );

  test(
    'le repository propage une erreur API sans inventer des préférences',
    () async {
      final endpoints = ApiEndpoints(Uri.parse('http://10.0.2.2:4000'));
      final client = FakeApiClient(
        handler: (uri) async => throw const NetworkFailure(),
      );
      final repo = HousingPreferenceRepository(
        client: client,
        endpoints: endpoints,
      );
      await expectLater(repo.get(), throwsA(isA<NetworkFailure>()));
    },
  );
}
