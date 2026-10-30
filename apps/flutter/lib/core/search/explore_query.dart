import '../json/json_map.dart';
import 'geo_search.dart';

const Object _unset = Object();

/// Critères d'Explorer, alignés sur `SearchQueryDto` Nest.
///
/// Le curseur de pagination n'appartient pas à ce modèle : un changement
/// de critères doit toujours relancer la première page.
class ExploreQuery {
  const ExploreQuery({
    this.q,
    this.listingType,
    this.propertyType,
    this.city,
    this.commune,
    this.neighborhood,
    this.minPrice,
    this.maxPrice,
    this.minSurface,
    this.maxSurface,
    this.bedrooms,
    this.bathrooms,
    this.amenities,
    this.lat,
    this.lng,
    this.radius,
    this.sort,
    this.limit,
    this.view,
  });

  final String? q;
  final String? listingType;
  final String? propertyType;
  final String? city;
  final String? commune;
  final String? neighborhood;
  final int? minPrice;
  final int? maxPrice;
  final int? minSurface;
  final int? maxSurface;
  final int? bedrooms;
  final int? bathrooms;
  final String? amenities;
  final double? lat;
  final double? lng;
  final double? radius;
  final String? sort;
  final int? limit;

  /// `map` pour la vue cartographique. Jamais envoyé à Nest.
  final String? view;

  bool get isMapView => view == 'map';

  bool get hasGeo => GeoSearch.isPair(lat, lng);

  List<String> get listingTypes => _split(listingType);
  List<String> get propertyTypes => _split(propertyType);
  List<String> get amenityCodes => _split(amenities);

  bool get hasText => q != null && q!.trim().isNotEmpty;

  bool get hasUserIntent =>
      hasText ||
      listingType != null ||
      propertyType != null ||
      city != null ||
      commune != null ||
      neighborhood != null ||
      minPrice != null ||
      maxPrice != null ||
      minSurface != null ||
      maxSurface != null ||
      bedrooms != null ||
      bathrooms != null ||
      amenities != null ||
      hasGeo;

  /// Filtres structurés, hors texte et tri.
  int get activeFilterCount {
    var count = 0;
    if (listingType != null) count += 1;
    if (propertyType != null) count += 1;
    if (city != null) count += 1;
    if (commune != null) count += 1;
    if (neighborhood != null) count += 1;
    if (minPrice != null || maxPrice != null) count += 1;
    if (minSurface != null || maxSurface != null) count += 1;
    if (bedrooms != null) count += 1;
    if (bathrooms != null) count += 1;
    if (amenities != null) count += 1;
    if (hasGeo) count += 1;
    return count;
  }

  String? get budgetError {
    if (minPrice != null && minPrice! < 0) {
      return 'Le prix minimum doit être positif.';
    }
    if (maxPrice != null && maxPrice! < 0) {
      return 'Le prix maximum doit être positif.';
    }
    if (minPrice != null && maxPrice != null && minPrice! > maxPrice!) {
      return 'Le prix minimum ne peut pas dépasser le prix maximum.';
    }
    return null;
  }

  String? get surfaceError {
    if (minSurface != null && maxSurface != null && minSurface! > maxSurface!) {
      return 'La surface minimale ne peut pas dépasser la maximale.';
    }
    return null;
  }

  factory ExploreQuery.fromParams(Map<String, String> params) {
    return ExploreQuery.fromUri(Uri(queryParameters: params));
  }

  factory ExploreQuery.fromUri(Uri uri) {
    final params = uri.queryParameters;
    return ExploreQuery(
      q: asNonEmptyString(params['q']),
      listingType: asNonEmptyString(params['listingType']),
      propertyType: asNonEmptyString(params['propertyType']),
      city: asNonEmptyString(params['city']),
      commune: asNonEmptyString(params['commune']),
      neighborhood: asNonEmptyString(params['neighborhood']),
      minPrice: asInt(params['minPrice']),
      maxPrice: asInt(params['maxPrice']),
      minSurface: asInt(params['minSurface']),
      maxSurface: asInt(params['maxSurface']),
      bedrooms: asInt(params['bedrooms']),
      bathrooms: asInt(params['bathrooms']),
      amenities: asNonEmptyString(params['amenities']),
      lat: GeoSearch.parseCoord(params['lat'], latitude: true),
      lng: GeoSearch.parseCoord(params['lng'], latitude: false),
      radius: GeoSearch.parseRadius(params['radius']),
      sort: asNonEmptyString(params['sort']),
      limit: asInt(params['limit']),
      view: asNonEmptyString(params['view']),
    );
  }

  /// Clés acceptées par `POST/PATCH /saved-searches` (sans `sort`/`limit`).
  Map<String, String> toSavedSearchParams() {
    final params = toQueryParameters();
    params.remove('sort');
    params.remove('limit');
    params.remove('view');
    return params;
  }

  bool get hasAlertableCriteria =>
      listingType != null ||
      propertyType != null ||
      city != null ||
      commune != null ||
      neighborhood != null ||
      minPrice != null ||
      maxPrice != null ||
      minSurface != null ||
      maxSurface != null ||
      bedrooms != null ||
      bathrooms != null ||
      hasGeo;

  Map<String, String> toQueryParameters() {
    return <String, String>{
      if (hasText) 'q': q!.trim(),
      'listingType': ?listingType,
      'propertyType': ?propertyType,
      'city': ?city,
      'commune': ?commune,
      'neighborhood': ?neighborhood,
      if (minPrice != null) 'minPrice': '$minPrice',
      if (maxPrice != null) 'maxPrice': '$maxPrice',
      if (minSurface != null) 'minSurface': '$minSurface',
      if (maxSurface != null) 'maxSurface': '$maxSurface',
      if (bedrooms != null) 'bedrooms': '$bedrooms',
      if (bathrooms != null) 'bathrooms': '$bathrooms',
      'amenities': ?amenities,
      if (hasGeo) 'lat': '${GeoSearch.roundCoord(lat!)}',
      if (hasGeo) 'lng': '${GeoSearch.roundCoord(lng!)}',
      if (hasGeo) 'radius': '${radius ?? GeoSearch.defaultRadiusKm}',
      'sort': ?sort,
      if (isMapView) 'view': 'map',
    };
  }

  String toLocation({String path = '/explore'}) {
    final params = toQueryParameters();
    return Uri(
      path: path,
      queryParameters: params.isEmpty ? null : params,
    ).toString();
  }

  /// Query string envoyée à `GET /api/v1/search`.
  ///
  /// [cursor] est la pagination, pas un critère. [submit] correspond au
  /// flag Nest d'historisation (recherche validée par l'utilisateur).
  Map<String, Object?> toApiQuery({String? cursor, bool submit = false}) {
    return <String, Object?>{
      if (hasText) 'q': q!.trim(),
      if (listingType != null) 'listingType': listingType,
      if (propertyType != null) 'propertyType': propertyType,
      if (city != null) 'city': city,
      if (commune != null) 'commune': commune,
      if (neighborhood != null) 'neighborhood': neighborhood,
      if (minPrice != null) 'minPrice': '$minPrice',
      if (maxPrice != null) 'maxPrice': '$maxPrice',
      if (minSurface != null) 'minSurface': '$minSurface',
      if (maxSurface != null) 'maxSurface': '$maxSurface',
      if (bedrooms != null) 'bedrooms': '$bedrooms',
      if (bathrooms != null) 'bathrooms': '$bathrooms',
      if (amenities != null) 'amenities': amenities,
      if (hasGeo) 'lat': '${GeoSearch.roundCoord(lat!)}',
      if (hasGeo) 'lng': '${GeoSearch.roundCoord(lng!)}',
      if (hasGeo) 'radius': '${radius ?? GeoSearch.defaultRadiusKm}',
      if (sort != null) 'sort': sort,
      'limit': '${limit ?? (isMapView ? 50 : 20)}',
      if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
      if (submit) 'submit': 'true',
    };
  }

  ExploreQuery copyWith({
    Object? q = _unset,
    Object? listingType = _unset,
    Object? propertyType = _unset,
    Object? city = _unset,
    Object? commune = _unset,
    Object? neighborhood = _unset,
    Object? minPrice = _unset,
    Object? maxPrice = _unset,
    Object? minSurface = _unset,
    Object? maxSurface = _unset,
    Object? bedrooms = _unset,
    Object? bathrooms = _unset,
    Object? amenities = _unset,
    Object? lat = _unset,
    Object? lng = _unset,
    Object? radius = _unset,
    Object? sort = _unset,
    Object? limit = _unset,
    Object? view = _unset,
  }) {
    return ExploreQuery(
      q: identical(q, _unset) ? this.q : q as String?,
      listingType: identical(listingType, _unset)
          ? this.listingType
          : listingType as String?,
      propertyType: identical(propertyType, _unset)
          ? this.propertyType
          : propertyType as String?,
      city: identical(city, _unset) ? this.city : city as String?,
      commune: identical(commune, _unset) ? this.commune : commune as String?,
      neighborhood: identical(neighborhood, _unset)
          ? this.neighborhood
          : neighborhood as String?,
      minPrice: identical(minPrice, _unset) ? this.minPrice : minPrice as int?,
      maxPrice: identical(maxPrice, _unset) ? this.maxPrice : maxPrice as int?,
      minSurface: identical(minSurface, _unset)
          ? this.minSurface
          : minSurface as int?,
      maxSurface: identical(maxSurface, _unset)
          ? this.maxSurface
          : maxSurface as int?,
      bedrooms: identical(bedrooms, _unset) ? this.bedrooms : bedrooms as int?,
      bathrooms: identical(bathrooms, _unset)
          ? this.bathrooms
          : bathrooms as int?,
      amenities: identical(amenities, _unset)
          ? this.amenities
          : amenities as String?,
      lat: identical(lat, _unset) ? this.lat : lat as double?,
      lng: identical(lng, _unset) ? this.lng : lng as double?,
      radius: identical(radius, _unset) ? this.radius : radius as double?,
      sort: identical(sort, _unset) ? this.sort : sort as String?,
      limit: identical(limit, _unset) ? this.limit : limit as int?,
      view: identical(view, _unset) ? this.view : view as String?,
    );
  }

  ExploreQuery toggleCsv(String field, String code) {
    final current = switch (field) {
      'listingType' => listingTypes,
      'propertyType' => propertyTypes,
      'amenities' => amenityCodes,
      _ => const <String>[],
    };
    final next = [...current];
    if (next.contains(code)) {
      next.remove(code);
    } else {
      next.add(code);
    }
    final joined = next.isEmpty ? null : next.join(',');
    return switch (field) {
      'listingType' => copyWith(listingType: joined),
      'propertyType' => copyWith(propertyType: joined),
      'amenities' => copyWith(amenities: joined),
      _ => this,
    };
  }

  static List<String> _split(String? raw) {
    if (raw == null || raw.trim().isEmpty) {
      return const [];
    }
    return [
      for (final part in raw.split(','))
        if (part.trim().isNotEmpty) part.trim(),
    ];
  }

  @override
  bool operator ==(Object other) {
    return other is ExploreQuery &&
        other.q == q &&
        other.listingType == listingType &&
        other.propertyType == propertyType &&
        other.city == city &&
        other.commune == commune &&
        other.neighborhood == neighborhood &&
        other.minPrice == minPrice &&
        other.maxPrice == maxPrice &&
        other.minSurface == minSurface &&
        other.maxSurface == maxSurface &&
        other.bedrooms == bedrooms &&
        other.bathrooms == bathrooms &&
        other.amenities == amenities &&
        other.lat == lat &&
        other.lng == lng &&
        other.radius == radius &&
        other.sort == sort &&
        other.limit == limit &&
        other.view == view;
  }

  @override
  int get hashCode => Object.hashAll([
    q,
    listingType,
    propertyType,
    city,
    commune,
    neighborhood,
    minPrice,
    maxPrice,
    minSurface,
    maxSurface,
    bedrooms,
    bathrooms,
    amenities,
    lat,
    lng,
    radius,
    sort,
    limit,
    view,
  ]);
}
