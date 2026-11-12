import '../json/json_map.dart';
import 'listing_type_label.dart';
import 'money_format.dart';

/// Élément `SearchResultItem` Nest (`GET /search` et `listing` des recos).
class ListingSummary {
  const ListingSummary({
    required this.listingId,
    required this.propertyId,
    required this.title,
    required this.listingType,
    required this.propertyTypeName,
    this.propertyTypeCode,
    this.price,
    this.surface,
    this.landSurface,
    this.bedrooms,
    this.bathrooms,
    this.cityName,
    this.communeName,
    this.neighborhoodName,
    this.mainImageUrl,
    this.latitude,
    this.longitude,
    this.precision,
    this.distanceKm,
  });

  final String listingId;
  final String propertyId;
  final String title;
  final String listingType;
  final String propertyTypeName;
  final String? propertyTypeCode;
  final ListingPrice? price;
  final int? surface;
  final int? landSurface;
  final int? bedrooms;
  final int? bathrooms;
  final String? cityName;
  final String? communeName;
  final String? neighborhoodName;
  final String? mainImageUrl;
  final double? latitude;
  final double? longitude;
  final String? precision;
  final double? distanceKm;

  bool get hasPublicMapPoint {
    if (latitude == null || longitude == null) {
      return false;
    }
    if (precision == 'NONE') {
      return false;
    }
    if (latitude!.isNaN || longitude!.isNaN) {
      return false;
    }
    if (latitude!.abs() > 90 || longitude!.abs() > 180) {
      return false;
    }
    return true;
  }

  String get listingTypeLabel => ListingTypeLabel.of(listingType);

  String get priceLabel => MoneyFormat.formatPrice(price);

  String get locationLabel {
    final parts = <String>[?neighborhoodName, ?communeName, ?cityName];
    if (parts.isEmpty) {
      return 'Localisation non renseignée';
    }
    return parts.join(' · ');
  }

  String? get specsLabel {
    final parts = <String>[
      if (bedrooms != null) '$bedrooms ch.',
      if (bathrooms != null) '$bathrooms sdb',
      if (surface != null) '$surface m²',
      if (landSurface != null) '$landSurface m² terrain',
    ];
    if (parts.isEmpty) {
      return null;
    }
    return parts.join(' · ');
  }

  static ListingSummary fromJson(Map<String, Object?> json) {
    final listingId = asNonEmptyString(json['listingId']);
    final propertyId = asNonEmptyString(json['propertyId']);
    final title = asNonEmptyString(json['title']);
    final listingType = asNonEmptyString(json['listingType']);
    if (listingId == null ||
        propertyId == null ||
        title == null ||
        listingType == null) {
      throw const FormatException('Annonce : identifiants ou titre manquants.');
    }

    final propertyType = asJsonMapOrNull(json['propertyType']);
    final location = asJsonMapOrNull(json['location']);
    final city = asJsonMapOrNull(location?['city']);
    final commune = asJsonMapOrNull(location?['commune']);
    final neighborhood = asJsonMapOrNull(location?['neighborhood']);
    final distance = asJsonMapOrNull(json['distance']);
    final precision = asNonEmptyString(location?['precision']);
    final latitude = asDouble(location?['latitude']);
    final longitude = asDouble(location?['longitude']);

    return ListingSummary(
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
      landSurface: asInt(json['landSurface']),
      bedrooms: asInt(json['bedrooms']),
      bathrooms: asInt(json['bathrooms']),
      cityName: asNonEmptyString(city?['name']),
      communeName: asNonEmptyString(commune?['name']),
      neighborhoodName: asNonEmptyString(neighborhood?['name']),
      mainImageUrl: asNonEmptyString(json['mainImage']),
      latitude: latitude,
      longitude: longitude,
      precision: precision,
      distanceKm: asDouble(distance?['value']),
    );
  }

  static ListingSummary? tryFromJson(Object? raw) {
    try {
      return fromJson(asJsonMap(raw));
    } catch (_) {
      return null;
    }
  }
}
