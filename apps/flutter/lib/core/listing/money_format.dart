import 'package:intl/intl.dart';

/// Formatage des prix Nest `{ amount, currency, period }`.
///
/// Ne convertit jamais une devise. N'invente pas une périodicité.
class ListingPrice {
  const ListingPrice({
    required this.amount,
    required this.currency,
    this.period,
  });

  final num amount;
  final String currency;
  final String? period;

  static ListingPrice? tryParse(Object? json) {
    if (json == null) {
      return null;
    }
    if (json is! Map) {
      return null;
    }
    final map = json.map((key, value) => MapEntry(key.toString(), value));
    final amount = map['amount'];
    final currency = map['currency'];
    num? parsedAmount;
    if (amount is num) {
      parsedAmount = amount;
    } else if (amount is String) {
      parsedAmount = num.tryParse(amount.trim());
    }
    if (parsedAmount == null ||
        currency is! String ||
        currency.trim().isEmpty) {
      return null;
    }
    final period = map['period'];
    return ListingPrice(
      amount: parsedAmount,
      currency: currency.trim(),
      period: period is String && period.trim().isNotEmpty
          ? period.trim()
          : null,
    );
  }
}

abstract final class MoneyFormat {
  static final NumberFormat _fr = NumberFormat.decimalPattern('fr');

  static String formatAmount(num amount, String currency) {
    final formatted = _fr.format(amount.round());
    return '$formatted ${currencyLabel(currency)}';
  }

  /// Libellé d'affichage. XOF / CFA / FCFA → « F CFA » comme le site web.
  static String currencyLabel(String currency) {
    switch (currency.toUpperCase()) {
      case 'XOF':
      case 'CFA':
      case 'FCFA':
        return 'F CFA';
      default:
        return currency;
    }
  }

  /// Suffixe uniquement si le backend fournit une période connue.
  static String? periodLabel(String? period) {
    return switch (period) {
      'MONTH' => '/ mois',
      'DAY' => '/ jour',
      'WEEK' => '/ semaine',
      'YEAR' => '/ an',
      'TOTAL' => 'prix total',
      _ => null,
    };
  }

  static String formatPrice(ListingPrice? price) {
    if (price == null) {
      return 'Prix sur demande';
    }
    final amount = formatAmount(price.amount, price.currency);
    final period = periodLabel(price.period);
    if (period == null) {
      return amount;
    }
    return '$amount $period';
  }
}
