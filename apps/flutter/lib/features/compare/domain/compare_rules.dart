import '../../../core/listing/listing_status_labels.dart';
import '../../../core/listing/money_format.dart';
import '../../account/domain/housing_preferences.dart';
import '../../listing/domain/listing_detail.dart';
import 'compare_models.dart';
import 'shortlist_entry.dart';

/// Comparaison déterministe. Aucun score inventé, aucune conversion de période.
abstract final class CompareRules {
  static const missingLabel = 'Information non renseignée';

  static double? parseArea(String? raw) {
    if (raw == null) {
      return null;
    }
    final normalized = raw.trim().replaceAll(' ', '').replaceAll(',', '.');
    if (normalized.isEmpty) {
      return null;
    }
    final value = double.tryParse(normalized);
    if (value == null || value <= 0) {
      return null;
    }
    return value;
  }

  static bool pricesComparable(ListingPrice? a, ListingPrice? b) {
    if (a == null || b == null) {
      return false;
    }
    if (a.amount < 0 || b.amount < 0) {
      return false;
    }
    if (a.currency.toUpperCase() != b.currency.toUpperCase()) {
      return false;
    }
    final periodA = a.period;
    final periodB = b.period;
    if (periodA == null || periodB == null || periodA != periodB) {
      return false;
    }
    return true;
  }

  /// Prix au m² uniquement si montant, surface et périodicité sont cohérents.
  static int? pricePerSquareMeter(ListingPrice? price, String? areaRaw) {
    final area = parseArea(areaRaw);
    if (price == null || area == null || price.amount <= 0) {
      return null;
    }
    return (price.amount / area).round();
  }

  static String? comparableArea(ListingDetail listing) {
    if (listing.isLand) {
      return listing.landSurface ?? listing.surface;
    }
    return listing.surface;
  }

  static BudgetFit budgetFit({
    required ListingDetail listing,
    required HousingPreferences preferences,
  }) {
    final max = preferences.maxBudget;
    final min = preferences.minBudget;
    if (max == null && min == null) {
      return BudgetFit.none;
    }
    final price = listing.price;
    if (price == null) {
      return BudgetFit.unknown;
    }
    if (price.currency.toUpperCase() != preferences.currency.toUpperCase()) {
      return BudgetFit.incomparable;
    }
    final period = preferences.budgetPeriod;
    if (period == null || price.period == null || period != price.period) {
      return BudgetFit.incomparable;
    }
    final amount = price.amount.round();
    if (max == null) {
      return BudgetFit.respects;
    }
    if (amount <= max) {
      return BudgetFit.respects;
    }
    final tolerance = preferences.tolerancePct.clamp(0, 30);
    final ceiling = (max * (100 + tolerance) / 100).floor();
    if (amount <= ceiling) {
      return BudgetFit.overTarget;
    }
    return BudgetFit.exceeds;
  }

  static String budgetFitLabel(BudgetFit fit) {
    return switch (fit) {
      BudgetFit.none => 'Pas de budget enregistré',
      BudgetFit.respects => 'Dans le budget',
      BudgetFit.overTarget => 'Au-dessus du budget cible, dans la tolérance',
      BudgetFit.exceeds => 'Dépasse le budget',
      BudgetFit.incomparable => 'Période ou devise non comparable',
      BudgetFit.unknown => missingLabel,
    };
  }

  static CompareReport build({
    required List<CompareItem> items,
    HousingPreferences preferences = const HousingPreferences(),
  }) {
    final loaded = [
      for (final item in items)
        if (item.isLoaded) item,
    ];
    return CompareReport(
      items: items,
      rows: loaded.length >= ShortlistLimits.minCompare
          ? _rows(loaded, preferences)
          : const [],
      insights: _insights(items, loaded, preferences),
      questions: loaded.length >= ShortlistLimits.minCompare
          ? _questions(loaded)
          : const [],
      preferences: preferences,
    );
  }
}

List<CriterionRow> _rows(
  List<CompareItem> loaded,
  HousingPreferences preferences,
) {
  if (loaded.isEmpty) {
    return const [];
  }
  final listings = [for (final item in loaded) item.listing!];
  final rows = <CriterionRow>[
    _row(
      'Transaction',
      listings.map((listing) => listing.listingTypeLabel).toList(),
    ),
    _row(
      'Type de bien',
      listings.map((listing) => listing.propertyTypeName).toList(),
    ),
    _row(
      'Localisation',
      listings.map((listing) => listing.location.label).toList(),
      missingWhen: (index) =>
          listings[index].location.communeName == null &&
          listings[index].location.neighborhoodName == null,
    ),
    _row(
      'Statut',
      listings
          .map((listing) => ListingStatusLabels.of(listing.status))
          .toList(),
    ),
    _priceRow(listings),
  ];

  if (listings.any((listing) => listing.bedrooms != null) ||
      preferences.bedrooms != null) {
    rows.add(
      _row(
        'Chambres',
        listings
            .map(
              (listing) => listing.bedrooms == null
                  ? CompareRules.missingLabel
                  : '${listing.bedrooms}',
            )
            .toList(),
        missingWhen: (index) => listings[index].bedrooms == null,
      ),
    );
  }
  if (listings.any((listing) => listing.bathrooms != null) ||
      preferences.bathrooms != null) {
    rows.add(
      _row(
        'Salles de bains',
        listings
            .map(
              (listing) => listing.bathrooms == null
                  ? CompareRules.missingLabel
                  : '${listing.bathrooms}',
            )
            .toList(),
        missingWhen: (index) => listings[index].bathrooms == null,
      ),
    );
  }

  final showLiving = listings.any(
    (listing) => !listing.isLand && listing.surface != null,
  );
  if (showLiving) {
    rows.add(
      _row(
        'Surface habitable',
        listings
            .map(
              (listing) => listing.isLand
                  ? '—'
                  : listing.surface == null
                  ? CompareRules.missingLabel
                  : '${listing.surface} m²',
            )
            .toList(),
        missingWhen: (index) =>
            !listings[index].isLand && listings[index].surface == null,
      ),
    );
  }
  if (listings.any(
    (listing) => listing.isLand || listing.landSurface != null,
  )) {
    rows.add(
      _row(
        'Surface terrain',
        listings
            .map(
              (listing) => listing.landSurface == null
                  ? CompareRules.missingLabel
                  : '${listing.landSurface} m²',
            )
            .toList(),
        missingWhen: (index) => listings[index].landSurface == null,
      ),
    );
  }

  final perMeter = [
    for (final listing in listings)
      CompareRules.pricePerSquareMeter(
        listing.price,
        CompareRules.comparableArea(listing),
      ),
  ];
  if (perMeter.any((value) => value != null)) {
    rows.add(
      _row('Prix au m²', [
        for (var i = 0; i < listings.length; i++)
          perMeter[i] == null
              ? CompareRules.missingLabel
              : '${MoneyFormat.formatAmount(perMeter[i]!, listings[i].price!.currency)}${_perMeterSuffix(listings[i])}',
      ], missingWhen: (index) => perMeter[index] == null),
    );
  }

  if (!preferences.isEmpty) {
    rows.add(
      _row('Budget enregistré', [
        for (final listing in listings)
          CompareRules.budgetFitLabel(
            CompareRules.budgetFit(listing: listing, preferences: preferences),
          ),
      ]),
    );
  }

  final amenityCodes = <String>{};
  for (final listing in listings) {
    for (final amenity in listing.amenities) {
      amenityCodes.add(amenity.code);
    }
  }
  for (final code in preferences.amenities) {
    amenityCodes.add(code);
  }
  final sortedCodes = amenityCodes.toList()..sort();
  for (final code in sortedCodes.take(8)) {
    rows.add(
      _row(
        amenityName(listings, code),
        [
          for (final listing in listings)
            listing.amenities.any((amenity) => amenity.code == code)
                ? 'Oui'
                : 'Non renseigné',
        ],
        missingWhen: (index) =>
            !listings[index].amenities.any((a) => a.code == code),
      ),
    );
  }

  if (listings.any((listing) => listing.publishedAt != null)) {
    rows.add(
      _row('Publication', [
        for (final listing in listings)
          listing.publishedAt == null
              ? CompareRules.missingLabel
              : listing.publishedAt!.toIso8601String().split('T').first,
      ], missingWhen: (index) => listings[index].publishedAt == null),
    );
  }

  rows.add(
    _row('Confiance', [
      for (final item in loaded)
        item.trust.listingBadges.isEmpty
            ? CompareRules.missingLabel
            : item.trust.listingBadges.map((badge) => badge.label).join(', '),
    ], missingWhen: (index) => loaded[index].trust.listingBadges.isEmpty),
  );
  return rows;
}

String _perMeterSuffix(ListingDetail listing) {
  if (listing.price?.period == 'MONTH') {
    return ' / mois';
  }
  return '';
}

String amenityName(List<ListingDetail> listings, String code) {
  for (final listing in listings) {
    for (final amenity in listing.amenities) {
      if (amenity.code == code) {
        return amenity.name;
      }
    }
  }
  return code;
}

CriterionRow _priceRow(List<ListingDetail> listings) {
  final cheapest = _cheapestIndices(listings);
  return CriterionRow(
    label: 'Prix',
    cells: [
      for (var i = 0; i < listings.length; i++)
        CriterionCell(
          value: listings[i].priceLabel,
          missing: listings[i].price == null,
          emphasized: cheapest.contains(i),
        ),
    ],
  );
}

Set<int> _cheapestIndices(List<ListingDetail> listings) {
  final groups = <String, List<int>>{};
  for (var i = 0; i < listings.length; i++) {
    final price = listings[i].price;
    if (price == null || price.period == null) {
      continue;
    }
    final key = '${price.currency.toUpperCase()}|${price.period}';
    groups.putIfAbsent(key, () => []).add(i);
  }
  final cheapest = <int>{};
  for (final indices in groups.values) {
    if (indices.length < 2) {
      continue;
    }
    var minAmount = listings[indices.first].price!.amount;
    for (final index in indices) {
      final amount = listings[index].price!.amount;
      if (amount < minAmount) {
        minAmount = amount;
      }
    }
    final tied = [
      for (final index in indices)
        if (listings[index].price!.amount == minAmount) index,
    ];
    if (tied.length < indices.length) {
      cheapest.addAll(tied);
    }
  }
  return cheapest;
}

CriterionRow _row(
  String label,
  List<String> values, {
  bool Function(int index)? missingWhen,
}) {
  final unique = values.toSet();
  final differ = unique.length > 1;
  return CriterionRow(
    label: label,
    cells: [
      for (var i = 0; i < values.length; i++)
        CriterionCell(
          value: values[i],
          missing: missingWhen?.call(i) ?? false,
          emphasized: differ && !(missingWhen?.call(i) ?? false),
        ),
    ],
  );
}

List<CompareInsight> _insights(
  List<CompareItem> items,
  List<CompareItem> loaded,
  HousingPreferences preferences,
) {
  final insights = <CompareInsight>[];
  final unavailable = [
    for (final item in items)
      if (item.status == CompareItemStatus.unavailable) item.entry.title,
  ];
  if (unavailable.isNotEmpty) {
    insights.add(
      CompareInsight(
        text:
            'Annonce${unavailable.length > 1 ? 's' : ''} plus disponible${unavailable.length > 1 ? 's' : ''} : ${unavailable.join(', ')}.',
        kind: 'unavailable',
      ),
    );
  }
  if (loaded.length < 2) {
    return insights;
  }
  final listings = [for (final item in loaded) item.listing!];
  final types = {for (final listing in listings) listing.listingType};
  if (types.length > 1) {
    insights.add(
      const CompareInsight(
        text: 'Les types de transaction diffèrent : les prix ne sont comparés que s\'ils partagent la même devise et la même périodicité.',
        kind: 'mix',
      ),
    );
  }

  final groups = <String, List<ListingDetail>>{};
  for (final listing in listings) {
    final price = listing.price;
    if (price == null || price.period == null) {
      continue;
    }
    final key = '${price.currency.toUpperCase()}|${price.period}';
    groups.putIfAbsent(key, () => []).add(listing);
  }
  for (final group in groups.values) {
    if (group.length < 2) {
      continue;
    }
    ListingDetail lowest = group.first;
    var allEqual = true;
    for (final listing in group.skip(1)) {
      if (listing.price!.amount != lowest.price!.amount) {
        allEqual = false;
      }
      if (listing.price!.amount < lowest.price!.amount) {
        lowest = listing;
      }
    }
    if (!allEqual) {
      insights.add(
        CompareInsight(
          text:
              '${lowest.title} est le moins cher parmi les prix ${MoneyFormat.periodLabel(lowest.price!.period) ?? ''} (${lowest.priceLabel}). Cela n\'en fait pas automatiquement le meilleur choix.',
          kind: 'price',
        ),
      );
    }
  }

  if (!preferences.isEmpty) {
    final inBudget = <String>[];
    final over = <String>[];
    for (final listing in listings) {
      final fit = CompareRules.budgetFit(
        listing: listing,
        preferences: preferences,
      );
      if (fit == BudgetFit.respects) {
        inBudget.add(listing.title);
      } else if (fit == BudgetFit.exceeds || fit == BudgetFit.overTarget) {
        final price = listing.price;
        final max = preferences.maxBudget;
        if (price != null &&
            max != null &&
            price.period == preferences.budgetPeriod) {
          final delta = price.amount.round() - max;
          over.add(
            '${listing.title} (écart ${MoneyFormat.formatAmount(delta, price.currency)})',
          );
        } else {
          over.add(listing.title);
        }
      }
    }
    if (inBudget.isNotEmpty) {
      insights.add(
        CompareInsight(
          text: 'Dans le budget enregistré : ${inBudget.join(', ')}.',
          kind: 'budget',
        ),
      );
    }
    if (over.isNotEmpty) {
      insights.add(
        CompareInsight(
          text: 'Au-delà du budget cible : ${over.join(', ')}.',
          kind: 'budget',
        ),
      );
    }
    if (preferences.bedrooms != null) {
      for (final listing in listings) {
        final rooms = listing.bedrooms;
        if (rooms == null) {
          insights.add(
            CompareInsight(
              text:
                  'Le nombre de chambres de « ${listing.title} » n\'est pas renseigné : la contrainte de ${preferences.bedrooms} chambres ne peut pas être vérifiée.',
              kind: 'constraint',
            ),
          );
        } else if (rooms < preferences.bedrooms!) {
          insights.add(
            CompareInsight(
              text:
                  '« ${listing.title} » a $rooms chambre(s) et ne respecte pas le minimum de ${preferences.bedrooms}.',
              kind: 'constraint',
            ),
          );
        }
      }
    }
  }

  for (final listing in listings) {
    if (listing.isLand && CompareRules.parseArea(listing.landSurface) == null) {
      insights.add(
        CompareInsight(
          text:
              'La surface de « ${listing.title} » n\'est pas renseignée : le prix au m² ne peut pas être calculé.',
          kind: 'missing',
        ),
      );
    }
  }
  return insights;
}

List<String> _questions(List<CompareItem> loaded) {
  final questions = <String>[];
  if (loaded.any(
    (item) =>
        item.listing!.listingType == 'RENT' ||
        item.listing!.listingType == 'SHORT_TERM_RENT',
  )) {
    questions.add(
      'Confirmez les charges, la caution et les frais d\'agence : ils ne figurent pas dans la fiche publique.',
    );
  }
  if (loaded.any((item) => item.listing!.isLand)) {
    questions.add(
      'Vérifiez les documents fonciers auprès de l\'annonceur : le statut juridique n\'est pas déduit de l\'annonce.',
    );
  }
  if (loaded.any((item) => item.listing!.location.isApproximate)) {
    questions.add(
      'La localisation affichée peut être approximative : confirmez l\'adresse exacte avant une visite.',
    );
  }
  if (loaded.any((item) => item.listing!.price == null)) {
    questions.add('Demandez le prix exact des annonces « Prix sur demande ».');
  }
  return questions;
}
