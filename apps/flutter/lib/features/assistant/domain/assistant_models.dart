import '../../../core/json/json_map.dart';
import '../../../core/listing/listing_summary.dart';
import '../../../core/listing/listing_type_label.dart';
import '../../../core/listing/money_format.dart';
import '../../../core/search/explore_query.dart';
import '../../../core/search/search_catalog.dart';

/// Longueur max alignée sur `AI_ASSISTANT_MAX_MESSAGE_LENGTH` Nest (défaut 2000).
const assistantMaxMessageLength = 2000;

enum AssistantMode { clarify, results, empty, error }

enum AssistantProvider { rules, openai, degraded }

enum AssistantSuggestionKind { forceSearch, classic, message }

enum AssistantFeedbackRating { helpful, notHelpful, wrongResults }

class AssistantCriteria {
  const AssistantCriteria({
    this.listingTypes = const [],
    this.propertyTypes = const [],
    this.communes = const [],
    this.neighborhoods = const [],
    this.cities = const [],
    this.priceMin,
    this.priceMax,
    this.pricePeriod,
    this.bedroomsMin,
    this.bathroomsMin,
    this.surfaceMin,
    this.surfaceMax,
    this.amenities = const [],
    this.clarificationQuestion,
    this.unverifiableHints = const [],
    this.acceptSearchWithoutBudget = false,
    this.acceptCityWide = false,
  });

  final List<String> listingTypes;
  final List<String> propertyTypes;
  final List<String> communes;
  final List<String> neighborhoods;
  final List<String> cities;
  final int? priceMin;
  final int? priceMax;
  final String? pricePeriod;
  final int? bedroomsMin;
  final int? bathroomsMin;
  final int? surfaceMin;
  final int? surfaceMax;
  final List<String> amenities;
  final String? clarificationQuestion;
  final List<String> unverifiableHints;
  final bool acceptSearchWithoutBudget;
  final bool acceptCityWide;

  factory AssistantCriteria.fromJson(Object? raw) {
    final json = asJsonMapOrNull(raw);
    if (json == null) {
      return const AssistantCriteria();
    }
    return AssistantCriteria(
      listingTypes: _stringList(json['listingTypes']),
      propertyTypes: _stringList(json['propertyTypes']),
      communes: _stringList(json['communes']),
      neighborhoods: _stringList(json['neighborhoods']),
      cities: _stringList(json['cities']),
      priceMin: asInt(json['priceMin']),
      priceMax: asInt(json['priceMax']),
      pricePeriod: asNonEmptyString(json['pricePeriod']),
      bedroomsMin: asInt(json['bedroomsMin']),
      bathroomsMin: asInt(json['bathroomsMin']),
      surfaceMin: asInt(json['surfaceMin']),
      surfaceMax: asInt(json['surfaceMax']),
      amenities: _stringList(json['amenities']),
      clarificationQuestion: asNonEmptyString(json['clarificationQuestion']),
      unverifiableHints: _stringList(json['unverifiableHints']),
      acceptSearchWithoutBudget: json['acceptSearchWithoutBudget'] == true,
      acceptCityWide: json['acceptCityWide'] == true,
    );
  }

  /// Chips issues uniquement des critères Nest, jamais inventées.
  List<String> get chips {
    final chips = <String>[];
    for (final type in listingTypes) {
      chips.add(ListingTypeLabel.of(type));
    }
    for (final type in propertyTypes) {
      chips.add(_catalogName(SearchCatalog.propertyTypes, type));
    }
    chips.addAll(communes);
    chips.addAll(neighborhoods);
    if (communes.isEmpty) {
      chips.addAll(cities);
    }
    if (bedroomsMin != null) {
      chips.add('$bedroomsMin+ ch.');
    }
    if (bathroomsMin != null) {
      chips.add('$bathroomsMin+ sdb');
    }
    if (priceMax != null) {
      chips.add('≤ ${_budgetChip(priceMax!)}');
    } else if (priceMin != null) {
      chips.add('≥ ${_budgetChip(priceMin!)}');
    }
    if (surfaceMin != null) {
      chips.add('≥ $surfaceMin m²');
    }
    if (surfaceMax != null) {
      chips.add('≤ $surfaceMax m²');
    }
    for (final amenity in amenities.take(3)) {
      chips.add(_catalogName(SearchCatalog.amenities, amenity));
    }
    return chips;
  }

  String _budgetChip(int amount) {
    final label = MoneyFormat.formatAmount(amount, 'XOF');
    final period = MoneyFormat.periodLabel(pricePeriod);
    if (period == null) {
      return label;
    }
    return '$label $period';
  }
}

class AssistantListingCard {
  const AssistantListingCard({
    required this.listingId,
    required this.propertyId,
    required this.title,
    required this.listingType,
    required this.propertyTypeName,
    this.propertyTypeCode,
    this.price,
    this.surface,
    this.bedrooms,
    this.bathrooms,
    this.locationLabel,
    this.mainImageUrl,
    this.matchReasons = const [],
  });

  final String listingId;
  final String propertyId;
  final String title;
  final String listingType;
  final String propertyTypeName;
  final String? propertyTypeCode;
  final ListingPrice? price;
  final int? surface;
  final int? bedrooms;
  final int? bathrooms;
  final String? locationLabel;
  final String? mainImageUrl;
  final List<String> matchReasons;

  ListingSummary get asSummary {
    return ListingSummary(
      listingId: listingId,
      propertyId: propertyId,
      title: title,
      listingType: listingType,
      propertyTypeName: propertyTypeName,
      propertyTypeCode: propertyTypeCode,
      price: price,
      surface: surface,
      bedrooms: bedrooms,
      bathrooms: bathrooms,
      cityName: locationLabel,
      mainImageUrl: mainImageUrl,
    );
  }

  static AssistantListingCard? tryFromJson(Object? raw) {
    try {
      final json = asJsonMap(raw);
      final listingId = asNonEmptyString(json['listingId']);
      final propertyId = asNonEmptyString(json['propertyId']);
      final title = asNonEmptyString(json['title']);
      final listingType = asNonEmptyString(json['listingType']);
      if (listingId == null ||
          propertyId == null ||
          title == null ||
          listingType == null) {
        return null;
      }
      final propertyType = asJsonMapOrNull(json['propertyType']);
      return AssistantListingCard(
        listingId: listingId,
        propertyId: propertyId,
        title: title,
        listingType: listingType,
        propertyTypeName:
            asNonEmptyString(propertyType?['name']) ??
            asNonEmptyString(propertyType?['code']) ??
            'Bien',
        propertyTypeCode: asNonEmptyString(propertyType?['code']),
        price: ListingPrice.tryParse(json['price']),
        surface: asInt(json['surface']),
        bedrooms: asInt(json['bedrooms']),
        bathrooms: asInt(json['bathrooms']),
        locationLabel: asNonEmptyString(json['locationLabel']),
        mainImageUrl: asNonEmptyString(json['mainImage']),
        matchReasons: _stringList(json['matchReasons']),
      );
    } catch (_) {
      return null;
    }
  }
}

class AssistantTurn {
  const AssistantTurn({
    required this.mode,
    required this.message,
    required this.conversationId,
    this.criteria = const AssistantCriteria(),
    this.searchParams = const {},
    this.listings = const [],
    this.suggestions = const [],
    this.provider = AssistantProvider.rules,
  });

  final AssistantMode mode;
  final String message;
  final String conversationId;
  final AssistantCriteria criteria;
  final Map<String, String> searchParams;
  final List<AssistantListingCard> listings;
  final List<String> suggestions;
  final AssistantProvider provider;

  bool get isDegraded =>
      provider == AssistantProvider.degraded || mode == AssistantMode.error;

  ExploreQuery get exploreQuery => exploreQueryFromSearchParams(searchParams);

  factory AssistantTurn.fromJson(Map<String, Object?> json) {
    final message = asNonEmptyString(json['message']);
    final conversationId = asNonEmptyString(json['conversationId']);
    if (message == null || conversationId == null) {
      throw const FormatException(
        'Tour assistant : message ou conversation manquant.',
      );
    }
    final rawListings = json['listings'];
    return AssistantTurn(
      mode: _modeOf(json['mode']),
      message: message,
      conversationId: conversationId,
      criteria: AssistantCriteria.fromJson(json['criteria']),
      searchParams: _stringMap(json['searchParams']),
      listings: rawListings is List
          ? rawListings
                .map(AssistantListingCard.tryFromJson)
                .whereType<AssistantListingCard>()
                .toList(growable: false)
          : const [],
      suggestions: _stringList(json['suggestions']),
      provider: _providerOf(json['provider']),
    );
  }
}

class AssistantChatRow {
  const AssistantChatRow.user(this.text) : turn = null;

  const AssistantChatRow.assistant(this.turn) : text = null;

  final String? text;
  final AssistantTurn? turn;

  bool get isUser => text != null;
}

class AssistantThread {
  const AssistantThread({
    this.conversationId,
    this.rows = const [],
    this.pending = false,
    this.error,
    this.compareIds = const {},
    this.generation = 0,
    this.retryMessage,
    this.retryForceSearch = false,
  });

  final String? conversationId;
  final List<AssistantChatRow> rows;
  final bool pending;
  final Object? error;
  final Set<String> compareIds;
  final int generation;
  final String? retryMessage;
  final bool retryForceSearch;

  AssistantTurn? get lastTurn {
    for (var i = rows.length - 1; i >= 0; i--) {
      final turn = rows[i].turn;
      if (turn != null) {
        return turn;
      }
    }
    return null;
  }

  AssistantThread copyWith({
    Object? conversationId = _unset,
    List<AssistantChatRow>? rows,
    bool? pending,
    Object? error = _unset,
    Set<String>? compareIds,
    int? generation,
    Object? retryMessage = _unset,
    bool? retryForceSearch,
  }) {
    return AssistantThread(
      conversationId: identical(conversationId, _unset)
          ? this.conversationId
          : conversationId as String?,
      rows: rows ?? this.rows,
      pending: pending ?? this.pending,
      error: identical(error, _unset) ? this.error : error,
      compareIds: compareIds ?? this.compareIds,
      generation: generation ?? this.generation,
      retryMessage: identical(retryMessage, _unset)
          ? this.retryMessage
          : retryMessage as String?,
      retryForceSearch: retryForceSearch ?? this.retryForceSearch,
    );
  }
}

const Object _unset = Object();

AssistantSuggestionKind suggestionKind(String suggestion) {
  final lower = suggestion.toLowerCase();
  if (lower.contains('lancer') ||
      lower.contains('sans budget') ||
      lower.contains('tout abidjan') ||
      lower.contains('force')) {
    return AssistantSuggestionKind.forceSearch;
  }
  if (lower.contains('classique') || lower.contains('ouvrir la recherche')) {
    return AssistantSuggestionKind.classic;
  }
  return AssistantSuggestionKind.message;
}

ExploreQuery exploreQueryFromSearchParams(Map<String, String> params) {
  final cleaned = Map<String, String>.from(params)
    ..remove('submit')
    ..remove('amenitiesMode');
  return ExploreQuery.fromParams(cleaned);
}

AssistantMode _modeOf(Object? raw) {
  return switch (asNonEmptyString(raw)) {
    'clarify' => AssistantMode.clarify,
    'results' => AssistantMode.results,
    'empty' => AssistantMode.empty,
    'error' => AssistantMode.error,
    _ => AssistantMode.error,
  };
}

AssistantProvider _providerOf(Object? raw) {
  return switch (asNonEmptyString(raw)) {
    'openai' => AssistantProvider.openai,
    'degraded' => AssistantProvider.degraded,
    _ => AssistantProvider.rules,
  };
}

List<String> _stringList(Object? raw) {
  if (raw is! List) {
    return const [];
  }
  return [for (final item in raw) ?asNonEmptyString(item)];
}

Map<String, String> _stringMap(Object? raw) {
  final json = asJsonMapOrNull(raw);
  if (json == null) {
    return const {};
  }
  final params = <String, String>{};
  for (final entry in json.entries) {
    final value = asNonEmptyString(entry.value);
    if (value != null) {
      params[entry.key] = value;
    }
  }
  return params;
}

String _catalogName(List<CatalogEntry> entries, String code) {
  for (final entry in entries) {
    if (entry.code == code) {
      return entry.name;
    }
  }
  return code;
}
