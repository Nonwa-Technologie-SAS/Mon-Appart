import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/features/publish/domain/publish_rules.dart';

void main() {
  test('un montant vide n\'est pas transformé en zéro', () {
    expect(PublishRules.parseAmount(''), isNull);
    expect(PublishRules.parseAmount('   '), isNull);
    expect(PublishRules.amountError(null, required: false), isNull);
    expect(PublishRules.amountError(0, required: true), isNotNull);
  });

  test('accepte un montant XOF entier avec espaces', () {
    expect(PublishRules.parseAmount('350 000'), 350000);
    expect(PublishRules.parseAmount('350000'), 350000);
    expect(PublishRules.parseAmount('12.5'), isNull);
  });

  test('périodes alignées sur Nest ALLOWED_PERIODS', () {
    expect(PublishRules.defaultPeriod('SALE'), 'TOTAL');
    expect(PublishRules.isPeriodAllowed('RENT', 'MONTH'), isTrue);
    expect(PublishRules.isPeriodAllowed('RENT', 'TOTAL'), isFalse);
    expect(PublishRules.isPeriodAllowed('SHORT_TERM_RENT', 'DAY'), isTrue);
  });

  test('complétude Nest : terrain vs résidentiel', () {
    expect(
      PublishRules.missingForCompleteness(
        title: 'Villa Cocody',
        propertyType: 'VILLA',
        category: 'RESIDENTIAL',
        latitude: 5.36,
        longitude: -3.96,
        surface: 120,
        landSurface: null,
        bedrooms: 3,
        bathrooms: 2,
      ),
      isEmpty,
    );
    expect(
      PublishRules.missingForCompleteness(
        title: 'Terrain',
        propertyType: 'LAND',
        category: 'LAND',
        latitude: null,
        longitude: null,
        surface: null,
        landSurface: null,
        bedrooms: null,
        bathrooms: null,
      ),
      ['coordinates', 'landSurface'],
    );
  });

  test('MIME par signature, pas par extension seule', () {
    expect(PublishRules.detectImageMime([0xFF, 0xD8, 0xFF]), 'image/jpeg');
    expect(
      PublishRules.detectImageMime([
        0x89,
        0x50,
        0x4E,
        0x47,
        0x0D,
        0x0A,
        0x1A,
        0x0A,
      ]),
      'image/png',
    );
    expect(
      PublishRules.detectImageMime([0x00, 0x00, 0x00], filename: 'photo.jpg'),
      isNull,
    );
    expect(
      PublishRules.detectImageMime([0x00], filename: 'photo.heic'),
      isNull,
    );
  });

  test('coordonnées hors Côte d\'Ivoire refusées', () {
    expect(PublishRules.coordinatesError(48.8, 2.3), isNotNull);
    expect(PublishRules.coordinatesError(5.36, -3.98), isNull);
    expect(PublishRules.coordinatesError(5.36, null), isNotNull);
  });
}
