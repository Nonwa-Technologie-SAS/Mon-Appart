/// Validations locales des préférences. Nest reste l'autorité.
abstract final class PreferenceRules {
  static const periods = <String, String>{
    'MONTH': 'Par mois',
    'DAY': 'Par jour',
    'TOTAL': 'Prix total',
  };

  static const _defaultPeriod = <String, String>{
    'RENT': 'MONTH',
    'SALE': 'TOTAL',
    'LEASE_TO_OWN': 'TOTAL',
    'SHORT_TERM_RENT': 'DAY',
  };

  static String? deducePeriod(Iterable<String> listingTypes) {
    final periods = <String>{
      for (final type in listingTypes) ?_defaultPeriod[type],
    };
    if (periods.length == 1) {
      return periods.first;
    }
    return null;
  }

  static String? budgetError({int? min, int? max}) {
    if (min != null && min < 0) {
      return 'Le budget minimum doit être positif.';
    }
    if (max != null && max < 1) {
      return 'Le budget maximum doit être au moins 1 F CFA.';
    }
    if (min != null && max != null && min > max) {
      return 'Le budget minimum ne peut pas dépasser le maximum.';
    }
    return null;
  }

  static String? toleranceError({required int pct, required int? maxBudget}) {
    if (pct < 0 || pct > 30) {
      return 'La tolérance doit être comprise entre 0 et 30 %.';
    }
    if (pct > 0 && maxBudget == null) {
      return 'La tolérance de budget exige un maximum.';
    }
    return null;
  }

  static String? surfaceError({int? min, int? max}) {
    if (min != null && max != null && min > max) {
      return 'La surface minimale ne peut pas dépasser la maximale.';
    }
    return null;
  }

  static String? periodError({
    required Iterable<String> listingTypes,
    required String? period,
    required bool hasBudget,
  }) {
    if (!hasBudget) {
      return null;
    }
    if (period != null && period.isNotEmpty) {
      return null;
    }
    if (deducePeriod(listingTypes) != null) {
      return null;
    }
    return 'Indiquez la périodicité du budget (mois, jour ou prix total).';
  }

  static int? parsePositiveInt(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      return null;
    }
    return int.tryParse(trimmed);
  }
}
