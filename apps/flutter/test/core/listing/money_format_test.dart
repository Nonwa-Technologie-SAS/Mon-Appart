import 'package:flutter_test/flutter_test.dart';
import 'package:mon_appart/core/listing/money_format.dart';

void main() {
  group('MoneyFormat', () {
    test('accepte un montant sérialisé en chaîne comme la fiche Nest', () {
      final price = ListingPrice.tryParse({
        'amount': '250000',
        'currency': 'XOF',
        'period': 'MONTH',
      });
      expect(price?.amount, 250000);
      expect(MoneyFormat.formatPrice(price), contains('/ mois'));
    });

    test('formate un loyer mensuel XOF comme le site web', () {
      const price = ListingPrice(
        amount: 250000,
        currency: 'XOF',
        period: 'MONTH',
      );
      final label = MoneyFormat.formatPrice(price);
      expect(label, contains('250'));
      expect(label, contains('F CFA'));
      expect(label, contains('/ mois'));
    });

    test('formate une vente sans la traiter comme un loyer', () {
      const price = ListingPrice(
        amount: 45000000,
        currency: 'XOF',
        period: 'TOTAL',
      );
      expect(MoneyFormat.formatPrice(price), contains('prix total'));
      expect(MoneyFormat.formatPrice(price), isNot(contains('/ mois')));
    });

    test('formate une location journalière', () {
      const price = ListingPrice(amount: 35000, currency: 'XOF', period: 'DAY');
      expect(MoneyFormat.formatPrice(price), contains('/ jour'));
    });

    test('n\'invente pas de période si elle est absente', () {
      const price = ListingPrice(amount: 1000, currency: 'EUR');
      final label = MoneyFormat.formatPrice(price);
      expect(label, contains('1'));
      expect(label, contains('000'));
      expect(label, endsWith('EUR'));
      expect(label, isNot(contains('/ mois')));
    });

    test('affiche Prix sur demande si le backend omet le prix', () {
      expect(MoneyFormat.formatPrice(null), 'Prix sur demande');
    });

    test('ne convertit pas une devise inconnue', () {
      expect(MoneyFormat.currencyLabel('GBP'), 'GBP');
    });
  });

  test('ListingPrice.tryParse ignore un objet incomplet', () {
    expect(ListingPrice.tryParse({'amount': 10}), isNull);
    expect(ListingPrice.tryParse(null), isNull);
  });
}
