import '../../../core/json/json_map.dart';
import '../../../core/search/search_catalog.dart';
import 'preference_rules.dart';

/// Préférences Nest `GET/PUT /api/v1/recommendations/preferences`.
class HousingPreferences {
  const HousingPreferences({
    this.listingTypes = const [],
    this.propertyTypes = const [],
    this.communes = const [],
    this.neighborhoods = const [],
    this.amenities = const [],
    this.minBudget,
    this.maxBudget,
    this.currency = 'XOF',
    this.budgetPeriod,
    this.tolerancePct = 0,
    this.bedrooms,
    this.bathrooms,
    this.minSurface,
    this.maxSurface,
    this.updatedAt,
  });

  final List<String> listingTypes;
  final List<String> propertyTypes;
  final List<String> communes;
  final List<String> neighborhoods;
  final List<String> amenities;
  final int? minBudget;
  final int? maxBudget;
  final String currency;
  final String? budgetPeriod;
  final int tolerancePct;
  final int? bedrooms;
  final int? bathrooms;
  final int? minSurface;
  final int? maxSurface;
  final DateTime? updatedAt;

  bool get isEmpty =>
      listingTypes.isEmpty &&
      propertyTypes.isEmpty &&
      communes.isEmpty &&
      neighborhoods.isEmpty &&
      amenities.isEmpty &&
      minBudget == null &&
      maxBudget == null &&
      bedrooms == null &&
      bathrooms == null &&
      minSurface == null &&
      maxSurface == null;

  String get summary {
    if (isEmpty) {
      return 'Aucune préférence enregistrée';
    }
    final parts = <String>[
      ...listingTypes.map(SearchCatalog.listingTypes.named),
      ...propertyTypes.map(SearchCatalog.propertyTypes.named),
      ...communes.map(
        (code) => SearchCatalog.communeByCode(code)?.name ?? code,
      ),
    ];
    return parts.where((part) => part.isNotEmpty).take(4).join(' · ');
  }

  HousingPreferences copyWith({
    List<String>? listingTypes,
    List<String>? propertyTypes,
    List<String>? communes,
    List<String>? neighborhoods,
    List<String>? amenities,
    int? minBudget,
    int? maxBudget,
    String? currency,
    String? budgetPeriod,
    int? tolerancePct,
    int? bedrooms,
    int? bathrooms,
    int? minSurface,
    int? maxSurface,
    bool clearMinBudget = false,
    bool clearMaxBudget = false,
    bool clearPeriod = false,
    bool clearBedrooms = false,
    bool clearBathrooms = false,
    bool clearMinSurface = false,
    bool clearMaxSurface = false,
  }) {
    return HousingPreferences(
      listingTypes: listingTypes ?? this.listingTypes,
      propertyTypes: propertyTypes ?? this.propertyTypes,
      communes: communes ?? this.communes,
      neighborhoods: neighborhoods ?? this.neighborhoods,
      amenities: amenities ?? this.amenities,
      minBudget: clearMinBudget ? null : (minBudget ?? this.minBudget),
      maxBudget: clearMaxBudget ? null : (maxBudget ?? this.maxBudget),
      currency: currency ?? this.currency,
      budgetPeriod: clearPeriod ? null : (budgetPeriod ?? this.budgetPeriod),
      tolerancePct: tolerancePct ?? this.tolerancePct,
      bedrooms: clearBedrooms ? null : (bedrooms ?? this.bedrooms),
      bathrooms: clearBathrooms ? null : (bathrooms ?? this.bathrooms),
      minSurface: clearMinSurface ? null : (minSurface ?? this.minSurface),
      maxSurface: clearMaxSurface ? null : (maxSurface ?? this.maxSurface),
      updatedAt: updatedAt,
    );
  }

  HousingPreferences toggle(String field, String code) {
    final current = switch (field) {
      'listingTypes' => listingTypes,
      'propertyTypes' => propertyTypes,
      'communes' => communes,
      'neighborhoods' => neighborhoods,
      'amenities' => amenities,
      _ => const <String>[],
    };
    final next = [...current];
    if (next.contains(code)) {
      next.remove(code);
    } else {
      next.add(code);
    }
    return switch (field) {
      'listingTypes' => copyWith(listingTypes: next),
      'propertyTypes' => copyWith(propertyTypes: next),
      'communes' => _withCommunes(next),
      'neighborhoods' => copyWith(neighborhoods: next),
      'amenities' => copyWith(amenities: next),
      _ => this,
    };
  }

  HousingPreferences _withCommunes(List<String> nextCommunes) {
    final allowed = <String>{};
    for (final code in nextCommunes) {
      final commune = SearchCatalog.communeByCode(code);
      if (commune == null) {
        continue;
      }
      for (final neighborhood in commune.neighborhoods) {
        allowed.add(neighborhood.code);
      }
    }
    return copyWith(
      communes: nextCommunes,
      neighborhoods: [
        for (final code in neighborhoods)
          if (allowed.contains(code)) code,
      ],
    );
  }

  Map<String, Object?> toCacheJson() {
    return {
      'listingTypes': listingTypes,
      'propertyTypes': propertyTypes,
      'communes': communes,
      'neighborhoods': neighborhoods,
      'amenities': amenities,
      'bedrooms': bedrooms,
      'bathrooms': bathrooms,
      'budget': {
        'min': minBudget,
        'max': maxBudget,
        'currency': currency,
        'period': budgetPeriod,
        'tolerancePct': tolerancePct,
      },
      'surface': {'min': minSurface, 'max': maxSurface},
      'updatedAt': updatedAt?.toUtc().toIso8601String(),
    };
  }

  Map<String, Object?> toPutBody() {
    final hasBudget = minBudget != null || maxBudget != null;
    return {
      'listingTypes': listingTypes,
      'propertyTypes': propertyTypes,
      'communes': communes,
      'neighborhoods': neighborhoods,
      'amenities': amenities,
      'currency': currency,
      'minBudget': minBudget,
      'maxBudget': maxBudget,
      'budgetPeriod': hasBudget
          ? (budgetPeriod ?? PreferenceRules.deducePeriod(listingTypes))
          : null,
      'budgetTolerancePct': maxBudget == null ? null : tolerancePct,
      'bedrooms': bedrooms,
      'bathrooms': bathrooms,
      'minSurface': minSurface,
      'maxSurface': maxSurface,
    };
  }

  static HousingPreferences fromJson(Map<String, Object?> json) {
    final budget = asJsonMapOrNull(json['budget']);
    final surface = asJsonMapOrNull(json['surface']);
    return HousingPreferences(
      listingTypes: _strings(json['listingTypes']),
      propertyTypes: _strings(json['propertyTypes']),
      communes: _strings(json['communes']),
      neighborhoods: _strings(json['neighborhoods']),
      amenities: _strings(json['amenities']),
      minBudget: asInt(budget?['min']),
      maxBudget: asInt(budget?['max']),
      currency: asNonEmptyString(budget?['currency']) ?? 'XOF',
      budgetPeriod: asNonEmptyString(budget?['period']),
      tolerancePct: asInt(budget?['tolerancePct']) ?? 0,
      bedrooms: asInt(json['bedrooms']),
      bathrooms: asInt(json['bathrooms']),
      minSurface: asInt(surface?['min']),
      maxSurface: asInt(surface?['max']),
      updatedAt: DateTime.tryParse(asNonEmptyString(json['updatedAt']) ?? ''),
    );
  }

  static List<String> _strings(Object? raw) {
    if (raw is! List) {
      return const [];
    }
    return [for (final item in raw) ?asNonEmptyString(item)];
  }
}

extension on List<CatalogEntry> {
  String named(String code) {
    for (final entry in this) {
      if (entry.code == code) {
        return entry.name;
      }
    }
    return code;
  }
}
