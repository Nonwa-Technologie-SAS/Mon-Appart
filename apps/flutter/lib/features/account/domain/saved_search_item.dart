import '../../../core/json/json_map.dart';
import '../../../core/listing/listing_type_label.dart';
import '../../../core/search/explore_query.dart';
import '../../../core/search/search_catalog.dart';

class SavedSearchItem {
  const SavedSearchItem({
    required this.id,
    required this.name,
    required this.params,
    required this.alertsEnabled,
    required this.frequency,
    required this.currency,
    this.listingType,
    this.minPrice,
    this.maxPrice,
  });

  final String id;
  final String name;
  final Map<String, String> params;
  final bool alertsEnabled;
  final String frequency;
  final String currency;
  final String? listingType;
  final int? minPrice;
  final int? maxPrice;

  ExploreQuery get query => ExploreQuery.fromParams(params);

  bool get alertsActive => alertsEnabled && frequency != 'PAUSED';

  String get frequencyLabel => switch (frequency) {
    'WEEKLY' => 'Chaque semaine',
    'PAUSED' => 'En pause',
    _ => 'Chaque jour',
  };

  SavedSearchItem copyWith({
    String? name,
    Map<String, String>? params,
    bool? alertsEnabled,
    String? frequency,
    String? listingType,
    int? minPrice,
    int? maxPrice,
    String? currency,
  }) {
    return SavedSearchItem(
      id: id,
      name: name ?? this.name,
      params: params ?? this.params,
      alertsEnabled: alertsEnabled ?? this.alertsEnabled,
      frequency: frequency ?? this.frequency,
      currency: currency ?? this.currency,
      listingType: listingType ?? this.listingType,
      minPrice: minPrice ?? this.minPrice,
      maxPrice: maxPrice ?? this.maxPrice,
    );
  }

  String get summary {
    final parts = <String>[
      if (listingType != null) ListingTypeLabel.of(listingType),
      if (minPrice != null || maxPrice != null)
        _priceRange(minPrice, maxPrice, currency),
      ?_communeLabel(params['commune']),
    ];
    return parts.isEmpty ? 'Critères enregistrés' : parts.join(' · ');
  }

  static SavedSearchItem? tryParse(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return null;
    }
    final id = asNonEmptyString(json['id']);
    final name = asNonEmptyString(json['name']);
    if (id == null || name == null) {
      return null;
    }
    final params = <String, String>{};
    final rawParams = json['params'];
    if (rawParams is Map) {
      rawParams.forEach((key, value) {
        final text = asNonEmptyString(value);
        if (text != null) {
          params['$key'] = text;
        }
      });
    }
    return SavedSearchItem(
      id: id,
      name: name,
      params: params,
      alertsEnabled: json['alertsEnabled'] == true,
      frequency: asNonEmptyString(json['frequency']) ?? 'DAILY',
      currency: asNonEmptyString(json['currency']) ?? 'XOF',
      listingType: asNonEmptyString(json['listingType']),
      minPrice: asInt(json['minPrice']),
      maxPrice: asInt(json['maxPrice']),
    );
  }

  static String? _communeLabel(Object? raw) {
    final code = asNonEmptyString(raw);
    if (code == null) {
      return null;
    }
    return SearchCatalog.communeByCode(code)?.name ?? code;
  }

  static String defaultName(ExploreQuery query) {
    final property = _catalogName(
      SearchCatalog.propertyTypes,
      query.propertyTypes.firstOrNull,
    );
    final need = switch (query.listingTypes.firstOrNull) {
      'RENT' => 'à louer',
      'SALE' => 'à vendre',
      'SHORT_TERM_RENT' => 'en meublé',
      'LEASE_TO_OWN' => 'en location-vente',
      _ => null,
    };
    final commune = SearchCatalog.communeByCode(query.commune)?.name;
    final buffer = StringBuffer();
    if (property != null) {
      buffer.write(property);
      if (need != null) {
        buffer.write(' $need');
      }
      if (commune != null) {
        buffer.write(' à $commune');
      }
    } else if (need != null) {
      buffer.write(need[0].toUpperCase() + need.substring(1));
      if (commune != null) {
        buffer.write(' à $commune');
      }
    } else if (commune != null) {
      buffer.write('Biens à $commune');
    } else if (query.hasText) {
      buffer.write(query.q!.trim());
    } else if (query.minPrice != null || query.maxPrice != null) {
      buffer.write('Dans mon budget');
    } else {
      buffer.write('Recherche enregistrée');
    }
    return _clip(buffer.toString(), 80);
  }

  static String? nameError(String raw) {
    final name = raw.trim();
    if (name.length < 2) {
      return 'Le nom doit contenir au moins 2 caractères.';
    }
    if (name.length > 80) {
      return 'Le nom ne doit pas dépasser 80 caractères.';
    }
    return null;
  }

  static String? _catalogName(List<CatalogEntry> entries, String? code) {
    if (code == null) {
      return null;
    }
    for (final entry in entries) {
      if (entry.code == code) {
        return entry.name;
      }
    }
    return code;
  }

  static String _clip(String value, int max) {
    if (value.length <= max) {
      return value;
    }
    return '${value.substring(0, max - 1)}…';
  }

  static String _priceRange(int? min, int? max, String currency) {
    if (min != null && max != null) {
      return '$min – $max $currency';
    }
    if (max != null) {
      return 'jusqu\'à $max $currency';
    }
    return 'à partir de $min $currency';
  }
}
